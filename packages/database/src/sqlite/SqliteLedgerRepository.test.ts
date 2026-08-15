// @vitest-environment node

import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  Account,
  AllocationPlan,
  Budget,
  Loan,
  Category,
  ImportBatch,
  ImportRow,
  LocalDate,
  Money,
  MonthlyJournal,
  RecurringRule,
  Tag,
  Transaction,
  Transfer,
} from "@nexora/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  validatePortableLedgerSnapshot,
} from "../backup/PortableLedgerSnapshot";
import { InMemoryLedgerRepository } from "../in-memory/InMemoryLedgerRepository";
import { databaseMigrations } from "../migrations/0001-initial-ledger-schema";
import { MigrationRunner } from "../migrations/MigrationRunner";
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

function account(id: string, type: "checking" | "savings" | "loan" = "checking"): Account {
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

  it("persists the two-level category hierarchy and rejects invalid parents", async () => {
    const macro = Category.create({ id: "macro", name: "Casa", kindScope: "expense" });
    const child = Category.create({
      id: "child",
      name: "Affitto",
      kindScope: "expense",
      parentId: macro.id,
    });
    await repository.saveCategory(macro);
    await repository.saveCategory(child);
    expect((await repository.findCategoryById(child.id))?.parentId).toBe(macro.id);

    await expect(
      repository.saveCategory(
        Category.create({
          id: "third",
          name: "Dettaglio",
          kindScope: "expense",
          parentId: child.id,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      repository.updateCategory(
        macro.update({ name: macro.name, kindScope: macro.kindScope, isArchived: true }),
      ),
    ).rejects.toThrow();
  });

  it("round-trips optional expense behavior and keeps legacy fields nullable", async () => {
    const main = account("account-behavior");
    await repository.saveAccount(main);
    const classified = Transaction.create({
      id: "expense-behavior",
      kind: "expense",
      status: "booked",
      accountId: main.id,
      amount: Money.fromMinor(-1_200n, "EUR"),
      bookedDate,
      expenseVariability: "fixed",
      expenseExceptionality: "ordinary",
    });
    await repository.saveTransaction(classified);
    expect(await repository.findTransactionById(classified.id)).toMatchObject({
      expenseVariability: "fixed",
      expenseExceptionality: "ordinary",
    });
    expect(
      sqlite
        .prepare(
          "SELECT expense_variability, expense_exceptionality FROM transactions WHERE id = ?",
        )
        .get(classified.id),
    ).toEqual({ expense_variability: "fixed", expense_exceptionality: "ordinary" });
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

  it("unisce categorie e tag senza lasciare riferimenti orfani", async () => {
    const main = account("account-management");
    const source = Category.create({
      id: "category-source",
      name: "Vecchia",
      kindScope: "expense",
    });
    const target = Category.create({ id: "category-target", name: "Nuova", kindScope: "expense" });
    const transaction = Transaction.create({
      id: "transaction-management",
      kind: "expense",
      status: "booked",
      accountId: main.id,
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
      categoryId: source.id,
    });
    const sourceTag = Tag.create({ id: "tag-source", name: "Vecchio" });
    const targetTag = Tag.create({ id: "tag-target", name: "Nuovo" });
    await repository.saveAccount(main);
    await repository.saveCategory(source);
    await repository.saveCategory(target);
    await repository.saveTransaction(transaction);
    await repository.saveTag(sourceTag);
    await repository.saveTag(targetTag);
    await repository.setTransactionTags(transaction.id, [sourceTag.id, targetTag.id]);

    await repository.mergeCategory(source.id, target.id);
    await repository.mergeTag(sourceTag.id, targetTag.id);

    await expect(repository.findCategoryById(source.id)).resolves.toBeUndefined();
    await expect(repository.findTransactionById(transaction.id)).resolves.toMatchObject({
      categoryId: target.id,
    });
    await expect(repository.listTransactionTags(transaction.id)).resolves.toEqual([targetTag]);
  });

  it("elimina solo conti senza riferimenti finanziari", async () => {
    const unused = account("account-unused");
    const used = account("account-used");
    await repository.saveAccount(unused);
    await repository.saveAccount(used);
    await repository.saveTransaction(
      Transaction.create({
        id: "transaction-used-account",
        kind: "expense",
        status: "booked",
        accountId: used.id,
        amount: Money.fromMinor(-100n, "EUR"),
        bookedDate,
      }),
    );

    await repository.deleteUnusedAccount(unused.id);
    await expect(repository.findAccountById(unused.id)).resolves.toBeUndefined();
    await expect(repository.deleteUnusedAccount(used.id)).rejects.toMatchObject({
      code: "invalid_account",
    });
  });

  it("azzera atomicamente tutti i dati finanziari", async () => {
    const main = account("account-reset");
    await repository.saveAccount(main);
    await repository.saveTransaction(
      Transaction.create({
        id: "transaction-reset",
        kind: "income",
        status: "booked",
        accountId: main.id,
        amount: Money.fromMinor(100n, "EUR"),
        bookedDate,
      }),
    );
    await repository.resetFinancialData();
    await expect(repository.listAccounts()).resolves.toEqual([]);
    await expect(repository.listTransactions()).resolves.toEqual([]);
  });

  it("azzera anche gerarchie e trasferimenti del ledger dimostrativo", async () => {
    await seedDemoLedger(repository);

    await repository.resetFinancialData();

    await expect(repository.listAccounts()).resolves.toEqual([]);
    expect((await repository.listCategories()).map((category) => category.id).sort()).toEqual([
      "system-expense",
      "system-income",
    ]);
    await expect(repository.listTransactions()).resolves.toEqual([]);
    await expect(repository.listTransfers()).resolves.toEqual([]);
  });

  it("elimina solo categorie e tag non referenziati", async () => {
    const main = account("account-taxonomy-delete");
    const unusedCategory = Category.create({
      id: "category-unused",
      name: "Libera",
      kindScope: "expense",
    });
    const usedCategory = Category.create({
      id: "category-used",
      name: "Usata",
      kindScope: "expense",
    });
    const unusedTag = Tag.create({ id: "tag-unused", name: "Libero" });
    const usedTag = Tag.create({ id: "tag-used", name: "Usato" });
    await repository.saveAccount(main);
    await repository.saveCategory(unusedCategory);
    await repository.saveCategory(usedCategory);
    await repository.saveTag(unusedTag);
    await repository.saveTag(usedTag);
    const transaction = Transaction.create({
      id: "taxonomy-reference",
      kind: "expense",
      status: "booked",
      accountId: main.id,
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
      categoryId: usedCategory.id,
    });
    await repository.saveTransaction(transaction);
    await repository.setTransactionTags(transaction.id, [usedTag.id]);

    await repository.deleteUnusedCategory(unusedCategory.id);
    await repository.deleteUnusedTag(unusedTag.id);
    await expect(repository.deleteUnusedCategory(usedCategory.id)).rejects.toMatchObject({
      code: "invalid_category",
    });
    await expect(repository.deleteUnusedTag(usedTag.id)).rejects.toMatchObject({
      code: "invalid_transaction",
    });
  });

  it("persiste e aggiorna il diario mensile", async () => {
    const journal = MonthlyJournal.create({
      id: "journal-2026-07",
      period: "2026-07",
      note: "Mese sotto controllo",
      perceivedControl: 4,
    });
    await repository.saveMonthlyJournal(journal);
    expect(await repository.listMonthlyJournals()).toEqual([journal]);

    const updated = MonthlyJournal.create({
      id: journal.id,
      period: journal.period,
      nextMonthGoals: "Ridurre le spese discrezionali",
      perceivedControl: 5,
    });
    await repository.updateMonthlyJournal(updated);
    expect(await repository.listMonthlyJournals()).toEqual([updated]);
  });

  it("elimina un diario mensile senza toccare il ledger", async () => {
    const journal = MonthlyJournal.create({ id: "journal-delete", period: "2026-08" });
    await repository.saveMonthlyJournal(journal);
    await repository.deleteMonthlyJournal(journal.id);
    await expect(repository.listMonthlyJournals()).resolves.toEqual([]);
    await expect(repository.deleteMonthlyJournal(journal.id)).rejects.toMatchObject({
      code: "missing_reference",
    });
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

  it("sposta nel cestino un trasferimento in modo atomico e lo ripristina", async () => {
    await repository.saveAccount(account("account-trash-a"));
    await repository.saveAccount(account("account-trash-b", "savings"));
    const debitTransaction = transferLeg("transfer-trash-debit", "account-trash-a", -100n);
    const creditTransaction = transferLeg("transfer-trash-credit", "account-trash-b", 100n);
    const transfer = Transfer.create({ id: "transfer-trash", debitTransaction, creditTransaction });
    await repository.saveTransfer({ transfer, debitTransaction, creditTransaction });

    await repository.trashTransaction(debitTransaction.id);
    await expect(repository.listTransactions()).resolves.toEqual([]);
    await expect(repository.findTransferById(transfer.id)).resolves.toBeUndefined();
    await expect(repository.listTrashedTransactions()).resolves.toHaveLength(2);

    await repository.restoreTransaction(creditTransaction.id);
    await expect(repository.findTransferById(transfer.id)).resolves.toEqual(transfer);
    await expect(repository.listTransactions()).resolves.toHaveLength(2);
  });

  it("fa rollback della selezione batch se un movimento non esiste", async () => {
    await repository.saveAccount(account("account-batch"));
    const transaction = Transaction.create({
      id: "transaction-batch",
      kind: "expense",
      status: "booked",
      accountId: "account-batch",
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
    });
    await repository.saveTransaction(transaction);
    await expect(
      repository.trashTransactions([transaction.id, "missing-batch"]),
    ).rejects.toMatchObject({ code: "missing_reference" });
    await expect(repository.listTrashedTransactions()).resolves.toEqual([]);
    await expect(repository.findTransactionById(transaction.id)).resolves.toEqual(transaction);
  });

  it("svuota gruppi del cestino in un unico commit", async () => {
    const savedAccount = account("account-purge-batch");
    const first = Transaction.create({
      id: "purge-batch-first",
      kind: "expense",
      status: "booked",
      accountId: savedAccount.id,
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
    });
    const second = Transaction.create({
      id: "purge-batch-second",
      kind: "income",
      status: "booked",
      accountId: savedAccount.id,
      amount: Money.fromMinor(200n, "EUR"),
      bookedDate,
    });
    await repository.saveAccount(savedAccount);
    await repository.saveTransaction(first);
    await repository.saveTransaction(second);
    await repository.trashTransactions([first.id, second.id]);

    await repository.purgeTrashedTransactions([first.id, second.id]);

    await expect(repository.listTrashedTransactions()).resolves.toEqual([]);
    await expect(repository.findTransactionById(first.id)).resolves.toBeUndefined();
    await expect(repository.findTransactionById(second.id)).resolves.toBeUndefined();
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
        fromVersion: 20,
        toVersion: 20,
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
      mappingProfileId: "mapping-profile-sqlite",
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

  it("persiste generic_csv v3 senza violare i vincoli importer legacy", async () => {
    const batch = ImportBatch.create({
      id: "batch-bank-type",
      importerType: "generic_csv",
      rowsTotal: 1,
      sourceFilename: "estratto.csv",
      sourceSha256: "e".repeat(64),
    });
    const row = ImportRow.create({
      id: "row-bank-type",
      batchId: batch.id,
      rowNumber: 1,
      rawJson: "{}",
      status: "needs_review",
    });

    await repository.saveImportBatch(batch, [row]);

    await expect(repository.findImportBatchById(batch.id)).resolves.toEqual(batch);
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
    const disabled = RecurringRule.create({
      id: rule.id,
      name: rule.name,
      kind: rule.kind,
      accountId: rule.accountId,
      amount: rule.amount,
      nominalDay: rule.nominalDay,
      weekendPolicy: rule.weekendPolicy,
      nextExpectedDate: rule.nextExpectedDate,
      enabled: false,
    });
    await repository.updateRecurringRule(disabled);
    await expect(repository.listRecurringRules()).resolves.toEqual([disabled]);
  });

  it("round-trips the advanced recurring schedule fields", async () => {
    const savedAccount = account("account-recurring-advanced");
    await repository.saveAccount(savedAccount);
    const rule = RecurringRule.create({
      id: "rule-sqlite-advanced",
      name: "Assicurazione annuale",
      kind: "expense",
      accountId: savedAccount.id,
      amount: Money.fromMinor(-120_000n, "EUR"),
      frequencyUnit: "year",
      interval: 1,
      nominalDay: 29,
      nominalMonth: 2,
      nextNominalDate: LocalDate.parse("2028-02-29"),
      weekendPolicy: "previous_business_day",
      expenseVariability: "fixed",
      expenseExceptionality: "ordinary",
      retiredAt: "2026-08-08T10:00:00.000Z",
      enabled: false,
    });

    await repository.saveRecurringRule(rule);
    await expect(repository.listRecurringRules()).resolves.toEqual([rule]);
  });

  it("opens a v16 monthly rule with an advanced-calendar legacy fallback", async () => {
    const legacySqlite = new DatabaseSync(":memory:");
    try {
      const database = nodeSqliteDatabase(legacySqlite);
      await new MigrationRunner({
        database,
        migrations: databaseMigrations.filter((migration) => migration.version <= 16),
      }).migrateToLatest();
      await database.run(
        "INSERT INTO accounts (id, name, type, institution, currency, parent_account_id, opening_balance_minor, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["legacy-rule-account", "Conto legacy", "checking", null, "EUR", null, "0", 0],
      );
      await database.run(
        "INSERT INTO recurring_rules (id, name, kind, account_id, amount_minor, currency, frequency, interval_months, nominal_day, weekend_policy, next_expected_date, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "legacy-rule",
          "Canone legacy",
          "expense",
          "legacy-rule-account",
          "-9900",
          "EUR",
          "monthly",
          2,
          31,
          "none",
          "2026-07-31",
          1,
        ],
      );

      const upgraded = await initializeSqliteLedger({
        database,
        backupProvider: {
          async createVerifiedBackup() {
            return {
              id: "test-budget-migration-backup",
              createdAt: "2026-08-11T00:00:00.000Z",
              checksumSha256: "0".repeat(64),
            };
          },
        },
      });
      await expect(upgraded.repository.listRecurringRules()).resolves.toMatchObject([
        {
          id: "legacy-rule",
          frequencyUnit: "month",
          interval: 2,
          nominalDay: 31,
          nextNominalDate: LocalDate.parse("2026-07-31"),
          nextExpectedDate: LocalDate.parse("2026-07-31"),
        },
      ]);
    } finally {
      legacySqlite.close();
    }
  });

  it("persiste un piano di allocazione", async () => {
    await repository.saveAccount(account("allocation-source"));
    await repository.saveAccount(account("allocation-target", "savings"));
    const plan = AllocationPlan.create({
      id: "plan-sqlite",
      name: "Risparmio",
      trigger: "salary",
      sourceAccountId: "allocation-source",
      targetAccountId: "allocation-target",
      amount: Money.fromMinor(17_000n, "EUR"),
    });
    await repository.saveAllocationPlan(plan);
    await expect(repository.listAllocationPlans()).resolves.toEqual([plan]);
    const paused = AllocationPlan.create({ ...plan, enabled: false, name: "Risparmio pausa" });
    await repository.updateAllocationPlan(paused);
    await expect(repository.listAllocationPlans()).resolves.toEqual([paused]);
    await repository.deleteAllocationPlan(paused.id);
    await expect(repository.listAllocationPlans()).resolves.toEqual([]);
  });

  it("persiste e aggiorna un budget mensile", async () => {
    const budget = Budget.create({
      id: "budget-sqlite",
      period: "2026-08",
      amount: Money.fromMinor(50_000n, "EUR"),
      firstAlertPercentage: 60,
      secondAlertPercentage: 90,
    });
    await repository.saveBudget(budget);
    await expect(repository.listBudgets()).resolves.toEqual([budget]);
    const updated = Budget.create({
      id: budget.id,
      period: budget.period,
      amount: Money.fromMinor(60_000n, "EUR"),
      firstAlertPercentage: budget.firstAlertPercentage!,
      secondAlertPercentage: budget.secondAlertPercentage!,
    });
    await repository.updateBudget(updated);
    await expect(repository.listBudgets()).resolves.toEqual([updated]);
  });
  it("rifiuta budget globali duplicati nello stesso periodo", async () => {
    await repository.saveBudget(
      Budget.create({
        id: "budget-global-one",
        period: "2026-08",
        amount: Money.fromMinor(50_000n, "EUR"),
        firstAlertPercentage: 80,
        secondAlertPercentage: 100,
      }),
    );
    await expect(
      repository.saveBudget(
        Budget.create({
          id: "budget-global-two",
          period: "2026-08",
          amount: Money.fromMinor(60_000n, "EUR"),
          firstAlertPercentage: 80,
          secondAlertPercentage: 100,
        }),
      ),
    ).rejects.toMatchObject({ code: "duplicate_entity" });
  });
  it("persiste un prestito", async () => {
    await repository.saveAccount(account("loan-account", "loan"));
    const loan = Loan.create({
      id: "loan-sqlite",
      accountId: "loan-account",
      lender: "Findomestic",
      installment: Money.fromMinor(17_200n, "EUR"),
      remainingPrincipal: Money.fromMinor(500_000n, "EUR"),
    });
    await repository.saveLoan(loan);
    await expect(repository.listLoans()).resolves.toEqual([loan]);
  });
  it("convalida il conto prestito anche quando aggiorna una posizione", async () => {
    await repository.saveAccount(account("loan-account", "loan"));
    const loan = Loan.create({
      id: "loan-validation",
      accountId: "loan-account",
      lender: "Findomestic",
      installment: Money.fromMinor(17_200n, "EUR"),
      remainingPrincipal: Money.fromMinor(500_000n, "EUR"),
    });
    await repository.saveLoan(loan);
    await expect(
      repository.updateLoan(
        Loan.create({
          id: loan.id,
          accountId: "missing",
          lender: loan.lender,
          installment: loan.installment,
          remainingPrincipal: loan.remainingPrincipal,
        }),
      ),
    ).rejects.toMatchObject({ code: "missing_reference" });
    await expect(repository.listLoans()).resolves.toEqual([loan]);
  });
  it("rifiuta due prestiti per lo stesso conto", async () => {
    await repository.saveAccount(account("loan-account", "loan"));
    await repository.saveLoan(
      Loan.create({
        id: "loan-one",
        accountId: "loan-account",
        lender: "Istituto uno",
        installment: Money.fromMinor(7_200n, "EUR"),
        remainingPrincipal: Money.fromMinor(200_000n, "EUR"),
      }),
    );
    await expect(
      repository.saveLoan(
        Loan.create({
          id: "loan-two",
          accountId: "loan-account",
          lender: "Istituto due",
          installment: Money.fromMinor(8_200n, "EUR"),
          remainingPrincipal: Money.fromMinor(150_000n, "EUR"),
        }),
      ),
    ).rejects.toMatchObject({ code: "duplicate_entity" });
  });
  it("ripristina uno snapshot portabile senza perdere precisione monetaria", async () => {
    const source = new InMemoryLedgerRepository();
    const sourceAccount = account("portable-account");
    const sourceTransaction = Transaction.create({
      accountId: sourceAccount.id,
      amount: Money.fromMinor(9_007_199_254_740_993n, "EUR"),
      bookedDate,
      id: "portable-income",
      kind: "income",
      status: "booked",
    });
    await source.saveAccount(sourceAccount);
    await source.saveTransaction(sourceTransaction);

    await repository.replacePortableSnapshot(
      validatePortableLedgerSnapshot(
        decodePortableLedgerSnapshot(
          encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(source)),
        ),
      ),
    );

    await expect(repository.listAccounts()).resolves.toEqual([sourceAccount]);
    await expect(repository.findTransactionById(sourceTransaction.id)).resolves.toEqual(
      sourceTransaction,
    );
  });

  it("sostituisce atomicamente un ledger che contiene sottoconti", async () => {
    const parent = account("restore-parent");
    const child = Account.create({
      id: "restore-child",
      name: "Spazio da sostituire",
      type: "virtual_subaccount",
      currency: "EUR",
      parentAccountId: parent.id,
    });
    await repository.saveAccount(parent);
    await repository.saveAccount(child);

    const source = new InMemoryLedgerRepository();
    const restoredAccount = account("restored-account");
    await source.saveAccount(restoredAccount);

    await expect(
      repository.replacePortableSnapshot(
        validatePortableLedgerSnapshot(
          decodePortableLedgerSnapshot(
            encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(source)),
          ),
        ),
      ),
    ).resolves.toBeUndefined();

    await expect(repository.listAccounts()).resolves.toEqual([restoredAccount]);
  });
});
