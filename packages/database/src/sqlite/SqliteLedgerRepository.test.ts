// @vitest-environment node

import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  Account,
  Category,
  ImportBatch,
  ImportRow,
  LocalDate,
  Money,
  RecurringRule,
  Tag,
  Transaction,
  Transfer,
} from "@nexora/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqliteDatabase, SqliteValue } from "./SqliteDatabase";
import { seedDemoLedger } from "../seed/demoLedgerSeed";
import { initializeSqliteLedger } from "./initializeSqliteLedger";
import type { SqliteLedgerRepository } from "./SqliteLedgerRepository";

const bookedDate = LocalDate.parse("2026-07-27");

function nodeSqliteDatabase(database: DatabaseSync): SqliteDatabase {
  return {
    async execute(sql: string): Promise<void> {
      database.exec(sql);
    },
    async query<Row extends object>(
      sql: string,
      parameters: readonly SqliteValue[] = [],
    ): Promise<readonly Row[]> {
      return database.prepare(sql).all(...parameters) as unknown as readonly Row[];
    },
    async run(sql: string, parameters: readonly SqliteValue[] = []): Promise<void> {
      database.prepare(sql).run(...parameters);
    },
  };
}

function account(id: string, type: "checking" | "savings" = "checking"): Account {
  return Account.create({
    id,
    name: `Conto ${id}`,
    type,
    currency: "EUR",
  });
}

function transferLeg(id: string, accountId: string, amountMinor: bigint): Transaction {
  return Transaction.create({
    id,
    kind: "transfer",
    status: "booked",
    accountId,
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate,
  });
}

describe("SqliteLedgerRepository", () => {
  let sqlite: DatabaseSync;
  let repository: SqliteLedgerRepository;

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    ({ repository } = await initializeSqliteLedger({
      database: nodeSqliteDatabase(sqlite),
      now: () => new Date("2026-07-27T10:00:00.000Z"),
    }));
  });

  afterEach(() => {
    sqlite.close();
  });

  it("persiste tag e associazioni transazionali", async () => {
    const main = account("account-tags");
    const transaction = Transaction.create({
      id: "expense-tags",
      kind: "expense",
      status: "booked",
      accountId: main.id,
      amount: Money.fromMinor(-1_200n, "EUR"),
      bookedDate,
    });
    const tag = Tag.create({ id: "tag-work", name: "Lavoro" });

    await repository.saveAccount(main);
    await repository.saveTransaction(transaction);
    await repository.saveTag(tag);
    await repository.setTransactionTags(transaction.id, [tag.id]);

    expect(await repository.listTags()).toEqual([tag]);
    expect(await repository.listTransactionTags(transaction.id)).toEqual([tag]);
    await expect(
      repository.setTransactionTags(transaction.id, ["unknown-tag"]),
    ).rejects.toMatchObject({
      code: "missing_reference",
    });
    expect(await repository.listTransactionTags(transaction.id)).toEqual([tag]);
  });

  it("ricostruisce conti, categorie e transazioni senza perdere precisione", async () => {
    const mainAccount = Account.create({
      id: "account-main",
      name: "Conto principale demo",
      type: "checking",
      institution: "Banca Demo",
      currency: "EUR",
      openingBalance: Money.fromMinor(900719925474099312345678901234567890n, "EUR"),
    });
    const space = Account.create({
      id: "space-demo",
      name: "Spazio demo",
      type: "virtual_subaccount",
      currency: "EUR",
      parentAccountId: mainAccount.id,
    });
    const category = Category.create({
      id: "category-demo",
      name: "Categoria demo",
      kindScope: "expense",
    });
    const expense = Transaction.create({
      id: "expense-demo",
      kind: "expense",
      status: "reconciled",
      accountId: mainAccount.id,
      amount: Money.fromMinor(-123456789012345678901234567890n, "EUR"),
      bookedDate,
      valueDate: LocalDate.parse("2026-07-28"),
      payee: "Controparte demo",
      description: "Descrizione sintetica",
      categoryId: category.id,
      note: "Nota sintetica",
      source: "manual",
    });

    await repository.saveAccount(mainAccount);
    await repository.saveAccount(space);
    await repository.saveCategory(category);
    await repository.saveTransaction(expense);

    await expect(repository.findAccountById(mainAccount.id)).resolves.toEqual(mainAccount);
    await expect(repository.findAccountById(space.id)).resolves.toEqual(space);
    await expect(repository.findCategoryById(category.id)).resolves.toEqual(category);
    await expect(repository.findTransactionById(expense.id)).resolves.toEqual(expense);
  });

  it("salva e ricostruisce atomicamente un trasferimento con fee", async () => {
    const debitAccount = account("account-debit");
    const creditAccount = account("account-credit", "savings");
    await repository.saveAccount(debitAccount);
    await repository.saveAccount(creditAccount);

    const debitTransaction = transferLeg("transfer-debit", debitAccount.id, -10_000n);
    const creditTransaction = transferLeg("transfer-credit", creditAccount.id, 10_000n);
    const feeTransaction = Transaction.create({
      id: "transfer-fee",
      kind: "expense",
      status: "booked",
      accountId: debitAccount.id,
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
    });
    const transfer = Transfer.create({
      id: "transfer-demo",
      debitTransaction,
      creditTransaction,
      feeTransaction,
    });

    await repository.saveTransfer({
      transfer,
      debitTransaction,
      creditTransaction,
      feeTransaction,
    });

    await expect(repository.findTransferById(transfer.id)).resolves.toEqual(transfer);
    await expect(repository.listTransfers()).resolves.toEqual([transfer]);
    await expect(repository.listTransactions()).resolves.toHaveLength(3);
  });

  it("esegue rollback senza lasciare gambe parziali", async () => {
    await repository.saveAccount(account("account-a"));
    await repository.saveAccount(account("account-b", "savings"));
    await repository.saveTransaction(
      Transaction.create({
        id: "credit-conflict",
        kind: "income",
        status: "booked",
        accountId: "account-b",
        amount: Money.fromMinor(500n, "EUR"),
        bookedDate,
      }),
    );

    const debitTransaction = transferLeg("debit-new", "account-a", -10_000n);
    const creditTransaction = transferLeg("credit-conflict", "account-b", 10_000n);
    const transfer = Transfer.create({
      id: "transfer-invalid",
      debitTransaction,
      creditTransaction,
    });

    await expect(
      repository.saveTransfer({
        transfer,
        debitTransaction,
        creditTransaction,
      }),
    ).rejects.toMatchObject({ code: "duplicate_entity" });
    await expect(repository.findTransactionById(debitTransaction.id)).resolves.toBeUndefined();
    await expect(repository.findTransferById(transfer.id)).resolves.toBeUndefined();
    await expect(repository.listTransactions()).resolves.toHaveLength(1);
  });

  it("annulla i movimenti e conserva atomico un trasferimento", async () => {
    await repository.saveAccount(account("account-cancel-a"));
    await repository.saveAccount(account("account-cancel-b", "savings"));
    const income = Transaction.create({
      id: "income-cancel",
      kind: "income",
      status: "booked",
      accountId: "account-cancel-a",
      amount: Money.fromMinor(500n, "EUR"),
      bookedDate,
    });
    await repository.saveTransaction(income);
    await repository.cancelTransaction(income.id);
    await expect(repository.findTransactionById(income.id)).resolves.toMatchObject({
      status: "cancelled",
    });

    const debitTransaction = transferLeg("transfer-cancel-debit", "account-cancel-a", -100n);
    const creditTransaction = transferLeg("transfer-cancel-credit", "account-cancel-b", 100n);
    const transfer = Transfer.create({
      id: "transfer-cancel",
      debitTransaction,
      creditTransaction,
    });
    await repository.saveTransfer({ transfer, debitTransaction, creditTransaction });

    await expect(repository.cancelTransaction(debitTransaction.id)).rejects.toMatchObject({
      code: "invalid_transfer",
    });
    await repository.cancelTransfer(transfer.id);
    await expect(repository.findTransactionById(debitTransaction.id)).resolves.toMatchObject({
      status: "cancelled",
    });
    await expect(repository.findTransactionById(creditTransaction.id)).resolves.toMatchObject({
      status: "cancelled",
    });
  });

  it("serializza operazioni concorrenti sulla stessa connessione", async () => {
    await Promise.all([
      repository.saveAccount(account("account-concurrent-a")),
      repository.saveAccount(account("account-concurrent-b", "savings")),
    ]);

    await expect(repository.listAccounts()).resolves.toHaveLength(2);
  });

  it("aggiorna un conto senza perdere precisione e blocca saldi retroattivi", async () => {
    const original = Account.create({
      id: "account-editable",
      name: "Conto originale",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(900719925474099312345678901234567890n, "EUR"),
    });
    await repository.saveAccount(original);
    const updated = original.update({
      name: "Conto aggiornato",
      institution: "Istituto demo",
      openingBalance: Money.fromMinor(900719925474099312345678901234567891n, "EUR"),
    });
    await repository.updateAccount(updated);

    await expect(repository.findAccountById(original.id)).resolves.toEqual(updated);

    await repository.saveTransaction(
      Transaction.create({
        id: "income-after-update",
        kind: "income",
        status: "booked",
        accountId: original.id,
        amount: Money.fromMinor(100n, "EUR"),
        bookedDate,
      }),
    );
    await expect(
      repository.updateAccount(
        updated.update({
          openingBalance: Money.fromMinor(900719925474099312345678901234567892n, "EUR"),
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_account" });
    await expect(repository.findAccountById(original.id)).resolves.toEqual(updated);
  });

  it("mantiene coerente l'archiviazione dei sottoconti", async () => {
    const parent = account("account-parent");
    const space = Account.create({
      id: "account-space",
      name: "Spazio demo",
      type: "virtual_subaccount",
      currency: "EUR",
      parentAccountId: parent.id,
    });
    await repository.saveAccount(parent);
    await repository.saveAccount(space);

    await expect(
      repository.updateAccount(parent.update({ isArchived: true })),
    ).rejects.toMatchObject({ code: "invalid_account" });
    await repository.updateAccount(space.update({ isArchived: true }));
    await repository.updateAccount(parent.update({ isArchived: true }));

    await expect(repository.findAccountById(parent.id)).resolves.toMatchObject({
      isArchived: true,
    });
    await expect(
      repository.updateAccount(space.update({ isArchived: false })),
    ).rejects.toMatchObject({ code: "invalid_account" });
    await expect(
      repository.saveAccount(
        Account.create({
          id: "account-space-new",
          name: "Nuovo spazio",
          type: "virtual_subaccount",
          currency: "EUR",
          parentAccountId: parent.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_account" });
  });

  it("applica il seed dimostrativo attraverso l'adapter SQLite", async () => {
    await expect(seedDemoLedger(repository)).resolves.toMatchObject({
      status: "created",
      inserted: { transactions: 8, transfers: 1 },
    });
    await expect(seedDemoLedger(repository)).resolves.toMatchObject({
      status: "already_present",
    });
    await expect(repository.listTransactions()).resolves.toHaveLength(8);
  });

  it("mantiene i dati dopo chiusura e riapertura del file SQLite", async () => {
    const databasePath = join(tmpdir(), `nexora-sqlite-reopen-${randomUUID()}.sqlite3`);
    let firstConnection: DatabaseSync | undefined;
    let secondConnection: DatabaseSync | undefined;

    try {
      firstConnection = new DatabaseSync(databasePath);
      const firstLedger = await initializeSqliteLedger({
        database: nodeSqliteDatabase(firstConnection),
      });
      const persistedAccount = account("account-persisted");
      await firstLedger.repository.saveAccount(persistedAccount);
      firstConnection.close();
      firstConnection = undefined;

      secondConnection = new DatabaseSync(databasePath);
      const secondLedger = await initializeSqliteLedger({
        database: nodeSqliteDatabase(secondConnection),
      });

      expect(secondLedger.migration).toEqual({
        fromVersion: 5,
        toVersion: 5,
        appliedMigrations: [],
      });
      await expect(secondLedger.repository.findAccountById(persistedAccount.id)).resolves.toEqual(
        persistedAccount,
      );
    } finally {
      firstConnection?.close();
      secondConnection?.close();
      rmSync(databasePath, { force: true });
    }
  });

  it("persiste batch e righe auditabili", async () => {
    const batch = ImportBatch.create({
      id: "batch-sqlite",
      importerType: "money_manager_xlsx",
      rowsTotal: 1,
      sourceFilename: "movimenti.xlsx",
      sourceSha256: "a".repeat(64),
    });
    const row = ImportRow.create({
      id: "row-sqlite",
      batchId: batch.id,
      rowNumber: 2,
      rawJson: "{}",
      status: "needs_review",
    });
    await repository.saveImportBatch(batch, [row]);
    await expect(repository.findImportBatchById(batch.id)).resolves.toEqual(batch);
    await expect(repository.listImportRows(batch.id)).resolves.toEqual([row]);
  });

  it("committa transazioni importate con il loro batch", async () => {
    const savedAccount = account("account-import");
    await repository.saveAccount(savedAccount);
    const batch = ImportBatch.create({
      id: "batch-commit",
      importerType: "money_manager_xlsx",
      rowsTotal: 1,
      sourceFilename: "movimenti.xlsx",
      sourceSha256: "c".repeat(64),
    });
    const transaction = Transaction.create({
      id: "transaction-import",
      kind: "income",
      status: "booked",
      accountId: savedAccount.id,
      amount: Money.fromMinor(100n, "EUR"),
      bookedDate,
      source: "import",
      importBatchId: batch.id,
      sourceFingerprint: "d".repeat(64),
    });
    const row = ImportRow.create({
      id: "row-commit",
      batchId: batch.id,
      rowNumber: 2,
      rawJson: "{}",
      status: "imported",
      createdTransactionId: transaction.id,
    });
    await expect(repository.commitImportBatch(batch, [row], [transaction])).resolves.toMatchObject({
      status: "committed",
    });
    await expect(repository.findTransactionById(transaction.id)).resolves.toEqual(transaction);
    await expect(repository.undoImportBatch(batch.id)).resolves.toMatchObject({ status: "undone" });
    await expect(repository.findTransactionById(transaction.id)).resolves.toMatchObject({
      status: "cancelled",
      importBatchId: batch.id,
    });
    await expect(repository.findImportBatchById(batch.id)).resolves.toMatchObject({
      status: "undone",
    });
  });

  it("persiste e aggiorna una ricorrenza mensile", async () => {
    const savedAccount = account("account-recurring");
    await repository.saveAccount(savedAccount);
    const rule = RecurringRule.create({
      id: "rule-sqlite",
      name: "Stipendio",
      kind: "income",
      accountId: savedAccount.id,
      amount: Money.fromMinor(250_000n, "EUR"),
      nominalDay: 28,
      weekendPolicy: "salary_italy",
      nextExpectedDate: LocalDate.parse("2026-07-28"),
    });
    await repository.saveRecurringRule(rule);
    await expect(repository.listRecurringRules()).resolves.toEqual([rule]);
    const disabled = RecurringRule.create({ ...rule, enabled: false });
    await repository.updateRecurringRule(disabled);
    await expect(repository.listRecurringRules()).resolves.toEqual([disabled]);
  });
});
