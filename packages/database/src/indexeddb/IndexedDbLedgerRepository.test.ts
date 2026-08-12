// @vitest-environment node

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
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  validatePortableLedgerSnapshot,
} from "../backup/PortableLedgerSnapshot";
import { InMemoryLedgerRepository } from "../in-memory/InMemoryLedgerRepository";
import type { IndexedDbLedger } from "./openIndexedDbLedger";
import { seedDemoLedger } from "../seed/demoLedgerSeed";
import { INDEXED_DB_SCHEMA_VERSION, openIndexedDbLedger } from "./openIndexedDbLedger";

const bookedDate = LocalDate.parse("2026-07-27");

async function createLegacyRecurringRulesDatabase(
  factory: IDBFactory,
  databaseName: string,
  version: 16 | 17,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = factory.open(databaseName, version);
    request.onupgradeneeded = () => {
      const database = request.result;
      const metadata = database.createObjectStore("metadata", { keyPath: "key" });
      metadata.put({ key: "schema_version", value: version });
      database.createObjectStore("accounts", { keyPath: "id" });
      database.createObjectStore("categories", { keyPath: "id" });
      database.createObjectStore("transactions", { keyPath: "id" });
      database.createObjectStore("transfers", { keyPath: "id" });
      database.createObjectStore("transaction_splits", { keyPath: "id" });
      database.createObjectStore("tags", { keyPath: "id" });
      database.createObjectStore("transaction_tags", { keyPath: ["transaction_id", "tag_id"] });
      database.createObjectStore("import_batches", { keyPath: "id" });
      database.createObjectStore("import_rows", { keyPath: "id" });
      const recurringRules = database.createObjectStore("recurring_rules", { keyPath: "id" });
      recurringRules.createIndex("by_due_date", ["enabled", "next_expected_date"], {
        unique: false,
      });
      recurringRules.createIndex("by_account_id", "account_id", { unique: false });
      if (version === 17) {
        recurringRules.createIndex(
          "by_active_due_date",
          ["retired_at", "enabled", "next_expected_date"],
          { unique: false },
        );
      }
      recurringRules.add({
        id: `legacy-rule-v${version}`,
        name: "Regola esistente",
        kind: "income",
        account_id: "legacy-account",
        amount_minor: "100",
        currency: "EUR",
        frequency: "monthly",
        interval_months: 1,
        nominal_day: 1,
        weekend_policy: "none",
        next_expected_date: "2026-06-01",
        enabled: true,
      });
      database.createObjectStore("allocation_plans", { keyPath: "id" });
      const budgets = database.createObjectStore("budgets", { keyPath: "id" });
      budgets.add({
        id: "legacy-budget",
        period: "2026-08",
        amount_minor: "50000",
        currency: "EUR",
        alert_at_80: true,
        alert_at_100: true,
      });
      database.createObjectStore("loans", { keyPath: "id" });
      database.createObjectStore("investment_positions", { keyPath: "id" });
      database.createObjectStore("monthly_journals", { keyPath: "id" });
      database.createObjectStore("transaction_trash", { keyPath: "transaction_id" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
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

describe("IndexedDbLedgerRepository", () => {
  let factory: IDBFactory;
  let databaseName: string;
  let ledger: IndexedDbLedger;

  beforeEach(async () => {
    factory = new IDBFactory();
    databaseName = `nexora-test-${crypto.randomUUID()}`;
    ledger = await openIndexedDbLedger({ databaseName, factory });
  });

  afterEach(async () => {
    await ledger.close();
  });

  it("persists the two-level category hierarchy and rejects invalid parents", async () => {
    const macro = Category.create({ id: "macro", name: "Casa", kindScope: "expense" });
    const child = Category.create({
      id: "child",
      name: "Affitto",
      kindScope: "expense",
      parentId: macro.id,
    });
    await ledger.repository.saveCategory(macro);
    await ledger.repository.saveCategory(child);
    expect((await ledger.repository.findCategoryById(child.id))?.parentId).toBe(macro.id);

    await expect(
      ledger.repository.saveCategory(
        Category.create({
          id: "third",
          name: "Dettaglio",
          kindScope: "expense",
          parentId: child.id,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      ledger.repository.updateCategory(
        macro.update({ name: macro.name, kindScope: macro.kindScope, isArchived: true }),
      ),
    ).rejects.toThrow();
  });

  it("round-trips optional expense behavior after a reopen", async () => {
    const main = account("account-behavior");
    await ledger.repository.saveAccount(main);
    await ledger.repository.saveTransaction(
      Transaction.create({
        id: "expense-behavior",
        kind: "expense",
        status: "booked",
        accountId: main.id,
        amount: Money.fromMinor(-1_200n, "EUR"),
        bookedDate,
        expenseVariability: "variable",
        expenseExceptionality: "extraordinary",
      }),
    );
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    expect(await ledger.repository.findTransactionById("expense-behavior")).toMatchObject({
      expenseVariability: "variable",
      expenseExceptionality: "extraordinary",
    });
  });

  it("persiste tag e associazioni atomiche dopo la riapertura", async () => {
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

    await ledger.repository.saveAccount(main);
    await ledger.repository.saveTransaction(transaction);
    await ledger.repository.saveTag(tag);
    await ledger.repository.setTransactionTags(transaction.id, [tag.id]);
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });

    expect(await ledger.repository.listTags()).toEqual([tag]);
    expect(await ledger.repository.listTransactionTags(transaction.id)).toEqual([tag]);
    await expect(
      ledger.repository.setTransactionTags(transaction.id, [tag.id, tag.id]),
    ).rejects.toMatchObject({ code: "duplicate_entity" });
    expect(await ledger.repository.listTransactionTags(transaction.id)).toEqual([tag]);
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
    await ledger.repository.saveAccount(main);
    await ledger.repository.saveCategory(source);
    await ledger.repository.saveCategory(target);
    await ledger.repository.saveTransaction(transaction);
    await ledger.repository.saveTag(sourceTag);
    await ledger.repository.saveTag(targetTag);
    await ledger.repository.setTransactionTags(transaction.id, [sourceTag.id, targetTag.id]);

    await ledger.repository.mergeCategory(source.id, target.id);
    await ledger.repository.mergeTag(sourceTag.id, targetTag.id);

    await expect(ledger.repository.findCategoryById(source.id)).resolves.toBeUndefined();
    await expect(ledger.repository.findTransactionById(transaction.id)).resolves.toMatchObject({
      categoryId: target.id,
    });
    await expect(ledger.repository.listTransactionTags(transaction.id)).resolves.toEqual([
      targetTag,
    ]);
  });

  it("elimina solo conti senza riferimenti finanziari", async () => {
    const unused = account("account-unused");
    const used = account("account-used");
    await ledger.repository.saveAccount(unused);
    await ledger.repository.saveAccount(used);
    await ledger.repository.saveTransaction(
      Transaction.create({
        id: "transaction-used-account",
        kind: "expense",
        status: "booked",
        accountId: used.id,
        amount: Money.fromMinor(-100n, "EUR"),
        bookedDate,
      }),
    );

    await ledger.repository.deleteUnusedAccount(unused.id);
    await expect(ledger.repository.findAccountById(unused.id)).resolves.toBeUndefined();
    await expect(ledger.repository.deleteUnusedAccount(used.id)).rejects.toMatchObject({
      code: "invalid_account",
    });
  });

  it("azzera atomicamente tutti i dati finanziari", async () => {
    const main = account("account-reset");
    await ledger.repository.saveAccount(main);
    await ledger.repository.saveTransaction(
      Transaction.create({
        id: "transaction-reset",
        kind: "income",
        status: "booked",
        accountId: main.id,
        amount: Money.fromMinor(100n, "EUR"),
        bookedDate,
      }),
    );
    await ledger.repository.resetFinancialData();
    await expect(ledger.repository.listAccounts()).resolves.toEqual([]);
    await expect(ledger.repository.listTransactions()).resolves.toEqual([]);
  });

  it("azzera anche gerarchie e trasferimenti del ledger dimostrativo", async () => {
    await seedDemoLedger(ledger.repository);

    await ledger.repository.resetFinancialData();

    await expect(ledger.repository.listAccounts()).resolves.toEqual([]);
    expect(
      (await ledger.repository.listCategories()).map((category) => category.id).sort(),
    ).toEqual(["system-expense", "system-income"]);
    await expect(ledger.repository.listTransactions()).resolves.toEqual([]);
    await expect(ledger.repository.listTransfers()).resolves.toEqual([]);
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
    await ledger.repository.saveAccount(main);
    await ledger.repository.saveCategory(unusedCategory);
    await ledger.repository.saveCategory(usedCategory);
    await ledger.repository.saveTag(unusedTag);
    await ledger.repository.saveTag(usedTag);
    const transaction = Transaction.create({
      id: "taxonomy-reference",
      kind: "expense",
      status: "booked",
      accountId: main.id,
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
      categoryId: usedCategory.id,
    });
    await ledger.repository.saveTransaction(transaction);
    await ledger.repository.setTransactionTags(transaction.id, [usedTag.id]);

    await ledger.repository.deleteUnusedCategory(unusedCategory.id);
    await ledger.repository.deleteUnusedTag(unusedTag.id);
    await expect(ledger.repository.deleteUnusedCategory(usedCategory.id)).rejects.toMatchObject({
      code: "invalid_category",
    });
    await expect(ledger.repository.deleteUnusedTag(usedTag.id)).rejects.toMatchObject({
      code: "invalid_transaction",
    });
  });

  it("persiste e aggiorna il diario mensile dopo la riapertura", async () => {
    const journal = MonthlyJournal.create({
      id: "journal-2026-07",
      period: "2026-07",
      note: "Mese sotto controllo",
      perceivedControl: 4,
    });
    await ledger.repository.saveMonthlyJournal(journal);
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });

    expect(await ledger.repository.listMonthlyJournals()).toEqual([journal]);
    const updated = MonthlyJournal.create({
      id: journal.id,
      period: journal.period,
      nextMonthGoals: "Ridurre le spese discrezionali",
      perceivedControl: 5,
    });
    await ledger.repository.updateMonthlyJournal(updated);
    expect(await ledger.repository.listMonthlyJournals()).toEqual([updated]);
  });

  it("elimina un diario mensile senza toccare il ledger", async () => {
    const journal = MonthlyJournal.create({ id: "journal-delete", period: "2026-08" });
    await ledger.repository.saveMonthlyJournal(journal);
    await ledger.repository.deleteMonthlyJournal(journal.id);
    await expect(ledger.repository.listMonthlyJournals()).resolves.toEqual([]);
    await expect(ledger.repository.deleteMonthlyJournal(journal.id)).rejects.toMatchObject({
      code: "missing_reference",
    });
  });

  it("crea atomicamente lo schema v1 con indici e metadati", async () => {
    expect(ledger.schemaVersion).toBe(INDEXED_DB_SCHEMA_VERSION);
    expect([...ledger.database.objectStoreNames]).toEqual([
      "accounts",
      "allocation_plans",
      "budgets",
      "categories",
      "import_batches",
      "import_rows",
      "investment_positions",
      "loans",
      "metadata",
      "monthly_journals",
      "recurring_rules",
      "tags",
      "transaction_splits",
      "transaction_tags",
      "transaction_trash",
      "transactions",
      "transfers",
    ]);

    const transaction = ledger.database.transaction(["metadata", "transactions"], "readonly");
    const metadataRequest = transaction.objectStore("metadata").get("schema_version");
    const indexes = [...transaction.objectStore("transactions").indexNames];
    const metadata = await new Promise<{ readonly key: string; readonly value: number }>(
      (resolve, reject) => {
        metadataRequest.onsuccess = () => {
          resolve(metadataRequest.result);
        };
        metadataRequest.onerror = () => {
          reject(metadataRequest.error);
        };
      },
    );

    expect(metadata).toEqual({ key: "schema_version", value: 19 });
    expect(indexes).toEqual(["by_account_id", "by_category_id"]);
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

    await ledger.repository.saveAccount(mainAccount);
    await ledger.repository.saveAccount(space);
    await ledger.repository.saveCategory(category);
    await ledger.repository.saveTransaction(expense);

    await expect(ledger.repository.findAccountById(mainAccount.id)).resolves.toEqual(mainAccount);
    await expect(ledger.repository.findAccountById(space.id)).resolves.toEqual(space);
    await expect(ledger.repository.findCategoryById(category.id)).resolves.toEqual(category);
    await expect(ledger.repository.findTransactionById(expense.id)).resolves.toEqual(expense);
  });

  it("salva e ricostruisce atomicamente un trasferimento con fee", async () => {
    const debitAccount = account("account-debit");
    const creditAccount = account("account-credit", "savings");
    await ledger.repository.saveAccount(debitAccount);
    await ledger.repository.saveAccount(creditAccount);

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

    await ledger.repository.saveTransfer({
      transfer,
      debitTransaction,
      creditTransaction,
      feeTransaction,
    });

    await expect(ledger.repository.findTransferById(transfer.id)).resolves.toEqual(transfer);
    await expect(ledger.repository.listTransfers()).resolves.toEqual([transfer]);
    await expect(ledger.repository.listTransactions()).resolves.toHaveLength(3);
  });

  it("esegue rollback senza lasciare gambe parziali", async () => {
    await ledger.repository.saveAccount(account("account-a"));
    await ledger.repository.saveAccount(account("account-b", "savings"));
    await ledger.repository.saveTransaction(
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
      ledger.repository.saveTransfer({
        transfer,
        debitTransaction,
        creditTransaction,
      }),
    ).rejects.toMatchObject({ code: "duplicate_entity" });
    await expect(
      ledger.repository.findTransactionById(debitTransaction.id),
    ).resolves.toBeUndefined();
    await expect(ledger.repository.findTransferById(transfer.id)).resolves.toBeUndefined();
    await expect(ledger.repository.listTransactions()).resolves.toHaveLength(1);
  });

  it("annulla i movimenti e conserva atomico un trasferimento", async () => {
    await ledger.repository.saveAccount(account("account-cancel-a"));
    await ledger.repository.saveAccount(account("account-cancel-b", "savings"));
    const income = Transaction.create({
      id: "income-cancel",
      kind: "income",
      status: "booked",
      accountId: "account-cancel-a",
      amount: Money.fromMinor(500n, "EUR"),
      bookedDate,
    });
    await ledger.repository.saveTransaction(income);
    await ledger.repository.cancelTransaction(income.id);
    await expect(ledger.repository.findTransactionById(income.id)).resolves.toMatchObject({
      status: "cancelled",
    });

    const debitTransaction = transferLeg("transfer-cancel-debit", "account-cancel-a", -100n);
    const creditTransaction = transferLeg("transfer-cancel-credit", "account-cancel-b", 100n);
    const transfer = Transfer.create({
      id: "transfer-cancel",
      debitTransaction,
      creditTransaction,
    });
    await ledger.repository.saveTransfer({ transfer, debitTransaction, creditTransaction });

    await expect(ledger.repository.cancelTransaction(debitTransaction.id)).rejects.toMatchObject({
      code: "invalid_transfer",
    });
    await ledger.repository.cancelTransfer(transfer.id);
    await expect(ledger.repository.findTransactionById(debitTransaction.id)).resolves.toMatchObject(
      { status: "cancelled" },
    );
    await expect(
      ledger.repository.findTransactionById(creditTransaction.id),
    ).resolves.toMatchObject({ status: "cancelled" });
  });

  it("sposta nel cestino un trasferimento in modo atomico e lo ripristina", async () => {
    await ledger.repository.saveAccount(account("account-trash-a"));
    await ledger.repository.saveAccount(account("account-trash-b", "savings"));
    const debitTransaction = transferLeg("transfer-trash-debit", "account-trash-a", -100n);
    const creditTransaction = transferLeg("transfer-trash-credit", "account-trash-b", 100n);
    const transfer = Transfer.create({ id: "transfer-trash", debitTransaction, creditTransaction });
    await ledger.repository.saveTransfer({ transfer, debitTransaction, creditTransaction });

    await ledger.repository.trashTransaction(debitTransaction.id);
    await expect(ledger.repository.listTransactions()).resolves.toEqual([]);
    await expect(ledger.repository.findTransferById(transfer.id)).resolves.toBeUndefined();
    await expect(ledger.repository.listTrashedTransactions()).resolves.toHaveLength(2);

    await ledger.repository.restoreTransaction(creditTransaction.id);
    await expect(ledger.repository.findTransferById(transfer.id)).resolves.toEqual(transfer);
    await expect(ledger.repository.listTransactions()).resolves.toHaveLength(2);
  });

  it("fa rollback della selezione batch se un movimento non esiste", async () => {
    await ledger.repository.saveAccount(account("account-batch"));
    const transaction = Transaction.create({
      id: "transaction-batch",
      kind: "expense",
      status: "booked",
      accountId: "account-batch",
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
    });
    await ledger.repository.saveTransaction(transaction);
    await expect(
      ledger.repository.trashTransactions([transaction.id, "missing-batch"]),
    ).rejects.toMatchObject({ code: "missing_reference" });
    await expect(ledger.repository.listTrashedTransactions()).resolves.toEqual([]);
    await expect(ledger.repository.findTransactionById(transaction.id)).resolves.toEqual(
      transaction,
    );
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
    await ledger.repository.saveAccount(savedAccount);
    await ledger.repository.saveTransaction(first);
    await ledger.repository.saveTransaction(second);
    await ledger.repository.trashTransactions([first.id, second.id]);

    await ledger.repository.purgeTrashedTransactions([first.id, second.id]);

    await expect(ledger.repository.listTrashedTransactions()).resolves.toEqual([]);
    await expect(ledger.repository.findTransactionById(first.id)).resolves.toBeUndefined();
    await expect(ledger.repository.findTransactionById(second.id)).resolves.toBeUndefined();
  });

  it("aggiorna un conto senza perdere precisione e blocca saldi retroattivi", async () => {
    const original = Account.create({
      id: "account-editable",
      name: "Conto originale",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(900719925474099312345678901234567890n, "EUR"),
    });
    await ledger.repository.saveAccount(original);
    const updated = original.update({
      name: "Conto aggiornato",
      institution: "Istituto demo",
      openingBalance: Money.fromMinor(900719925474099312345678901234567891n, "EUR"),
    });
    await ledger.repository.updateAccount(updated);

    await expect(ledger.repository.findAccountById(original.id)).resolves.toEqual(updated);

    await ledger.repository.saveTransaction(
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
      ledger.repository.updateAccount(
        updated.update({
          openingBalance: Money.fromMinor(900719925474099312345678901234567892n, "EUR"),
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_account" });
    await expect(ledger.repository.findAccountById(original.id)).resolves.toEqual(updated);
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
    await ledger.repository.saveAccount(parent);
    await ledger.repository.saveAccount(space);

    await expect(
      ledger.repository.updateAccount(parent.update({ isArchived: true })),
    ).rejects.toMatchObject({ code: "invalid_account" });
    await ledger.repository.updateAccount(space.update({ isArchived: true }));
    await ledger.repository.updateAccount(parent.update({ isArchived: true }));

    await expect(ledger.repository.findAccountById(parent.id)).resolves.toMatchObject({
      isArchived: true,
    });
    await expect(
      ledger.repository.updateAccount(space.update({ isArchived: false })),
    ).rejects.toMatchObject({ code: "invalid_account" });
    await expect(
      ledger.repository.saveAccount(
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

  it("mantiene i dati dopo chiusura e riapertura", async () => {
    const persistedAccount = Account.create({
      id: "account-persisted",
      name: "Conto persistente",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(900719925474099312345678901234567890n, "EUR"),
    });
    await ledger.repository.saveAccount(persistedAccount);
    await ledger.close();

    ledger = await openIndexedDbLedger({ databaseName, factory });

    expect(ledger.schemaVersion).toBe(INDEXED_DB_SCHEMA_VERSION);
    await expect(ledger.repository.findAccountById(persistedAccount.id)).resolves.toEqual(
      persistedAccount,
    );
  });

  it("mantiene il seed dimostrativo dopo la riapertura", async () => {
    await expect(seedDemoLedger(ledger.repository)).resolves.toMatchObject({
      status: "created",
      inserted: { transactions: 8, transfers: 1 },
    });
    await ledger.close();

    ledger = await openIndexedDbLedger({ databaseName, factory });

    await expect(seedDemoLedger(ledger.repository)).resolves.toMatchObject({
      status: "already_present",
    });
    await expect(ledger.repository.listTransactions()).resolves.toHaveLength(8);
  });

  it("rifiuta operazioni dopo la chiusura", async () => {
    await ledger.close();

    await expect(ledger.repository.listAccounts()).rejects.toMatchObject({
      code: "persistence_closed",
    });
  });

  it("persiste batch e righe auditabili", async () => {
    const batch = ImportBatch.create({
      id: "batch-idb",
      importerType: "generic_csv",
      rowsTotal: 1,
      sourceFilename: "movimenti.csv",
      sourceSha256: "a".repeat(64),
      mappingProfileId: "mapping-profile-idb",
    });
    const row = ImportRow.create({
      id: "row-idb",
      batchId: batch.id,
      rowNumber: 2,
      rawJson: "{}",
      status: "needs_review",
    });
    await ledger.repository.saveImportBatch(batch, [row]);
    await expect(ledger.repository.findImportBatchById(batch.id)).resolves.toEqual(batch);
    await expect(ledger.repository.listImportRows(batch.id)).resolves.toEqual([row]);
  });

  it("committa transazioni importate con il loro batch", async () => {
    const savedAccount = account("account-import");
    await ledger.repository.saveAccount(savedAccount);
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
    await expect(
      ledger.repository.commitImportBatch(batch, [row], [transaction]),
    ).resolves.toMatchObject({ status: "committed" });
    await expect(ledger.repository.findTransactionById(transaction.id)).resolves.toEqual(
      transaction,
    );
    await expect(ledger.repository.undoImportBatch(batch.id)).resolves.toMatchObject({
      status: "undone",
    });
    await expect(ledger.repository.findTransactionById(transaction.id)).resolves.toMatchObject({
      status: "cancelled",
      importBatchId: batch.id,
    });
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    await expect(ledger.repository.findImportBatchById(batch.id)).resolves.toMatchObject({
      status: "undone",
    });
    await expect(ledger.repository.findTransactionById(transaction.id)).resolves.toMatchObject({
      status: "cancelled",
    });
  });

  it("persiste una ricorrenza dopo la riapertura", async () => {
    const savedAccount = account("account-recurring");
    await ledger.repository.saveAccount(savedAccount);
    const rule = RecurringRule.create({
      id: "rule-idb",
      name: "Stipendio",
      kind: "income",
      accountId: savedAccount.id,
      amount: Money.fromMinor(250_000n, "EUR"),
      nominalDay: 28,
      weekendPolicy: "salary_italy",
      nextExpectedDate: LocalDate.parse("2026-07-28"),
    });
    await ledger.repository.saveRecurringRule(rule);
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    await expect(ledger.repository.listRecurringRules()).resolves.toEqual([rule]);
  });

  it("persists advanced recurring fields and opens a legacy-shaped record after reopening", async () => {
    const savedAccount = account("account-recurring-advanced");
    await ledger.repository.saveAccount(savedAccount);
    const rule = RecurringRule.create({
      id: "rule-idb-advanced",
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
    await ledger.repository.saveRecurringRule(rule);
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    await expect(ledger.repository.listRecurringRules()).resolves.toEqual([rule]);

    const legacyRule = RecurringRule.create({
      id: "rule-idb-legacy",
      name: "Canone legacy",
      kind: "expense",
      accountId: savedAccount.id,
      amount: Money.fromMinor(-9900n, "EUR"),
      nominalDay: 31,
      nextExpectedDate: LocalDate.parse("2026-07-31"),
    });
    await ledger.repository.saveRecurringRule(legacyRule);
    const transaction = ledger.database.transaction("recurring_rules", "readwrite");
    const store = transaction.objectStore("recurring_rules");
    const request = store.get(legacyRule.id);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const record = request.result as Record<string, unknown>;
        delete record.frequency_unit;
        delete record.interval_value;
        delete record.nominal_month;
        delete record.next_nominal_date;
        delete record.weekend_policy_v2;
        delete record.retired_at;
        delete record.expense_variability;
        delete record.expense_exceptionality;
        const put = store.put(record);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    await expect(ledger.repository.listRecurringRules()).resolves.toContainEqual(legacyRule);
  });

  it("indexes active advanced recurring rules by their effective due date", async () => {
    const savedAccount = account("account-recurring-index");
    await ledger.repository.saveAccount(savedAccount);
    const rule = RecurringRule.create({
      id: "rule-idb-index",
      name: "Settimanale",
      kind: "income",
      accountId: savedAccount.id,
      amount: Money.fromMinor(100n, "EUR"),
      frequencyUnit: "week",
      interval: 2,
      nominalDay: 1,
      nextNominalDate: LocalDate.parse("2026-06-01"),
      weekendPolicy: "none",
    });
    await ledger.repository.saveRecurringRule(rule);

    const transaction = ledger.database.transaction("recurring_rules", "readonly");
    const index = transaction.objectStore("recurring_rules").index("by_active_due_date");
    const rows = await new Promise<readonly { readonly id: string }[]>((resolve, reject) => {
      const request = index.getAll(["active", "2026-06-01"]);
      request.onsuccess = () => resolve(request.result as readonly { readonly id: string }[]);
      request.onerror = () => reject(request.error);
    });
    expect(rows.map((row) => row.id)).toContain(rule.id);
  });

  it.each([16, 17] as const)(
    "rebuilds and backfills the active due index when upgrading a v%s ledger",
    async (legacyVersion) => {
      await ledger.close();
      const legacyDatabaseName = `${databaseName}-legacy-v${legacyVersion}`;
      await createLegacyRecurringRulesDatabase(factory, legacyDatabaseName, legacyVersion);
      ledger = await openIndexedDbLedger({ databaseName: legacyDatabaseName, factory });

      const transaction = ledger.database.transaction("recurring_rules", "readonly");
      const index = transaction.objectStore("recurring_rules").index("by_active_due_date");
      expect(index.keyPath).toEqual(["active_due_state", "next_expected_date"]);
      const rows = await new Promise<readonly { readonly id: string }[]>((resolve, reject) => {
        const request = index.getAll(["active", "2026-06-01"]);
        request.onsuccess = () => resolve(request.result as readonly { readonly id: string }[]);
        request.onerror = () => reject(request.error);
      });

      expect(rows.map((row) => row.id)).toEqual([`legacy-rule-v${legacyVersion}`]);
    },
  );

  it("reads a legacy IndexedDB budget with its historical threshold semantics", async () => {
    await ledger.close();
    const legacyDatabaseName = `${databaseName}-legacy-budget`;
    await createLegacyRecurringRulesDatabase(factory, legacyDatabaseName, 16);
    ledger = await openIndexedDbLedger({ databaseName: legacyDatabaseName, factory });

    await expect(ledger.repository.listBudgets()).resolves.toContainEqual(
      expect.objectContaining({
        id: "legacy-budget",
        firstAlertPercentage: 80,
        secondAlertPercentage: 100,
      }),
    );
  });

  it("ripristina uno snapshot portabile e lo conserva alla riapertura", async () => {
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

    await ledger.repository.replacePortableSnapshot(
      validatePortableLedgerSnapshot(
        decodePortableLedgerSnapshot(
          encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(source)),
        ),
      ),
    );
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });

    await expect(ledger.repository.listAccounts()).resolves.toEqual([sourceAccount]);
    await expect(ledger.repository.findTransactionById(sourceTransaction.id)).resolves.toEqual(
      sourceTransaction,
    );
  });

  it("persiste un piano di allocazione", async () => {
    await ledger.repository.saveAccount(account("allocation-source"));
    await ledger.repository.saveAccount(account("allocation-target", "savings"));
    const plan = AllocationPlan.create({
      id: "plan-idb",
      name: "Directa",
      trigger: "salary",
      sourceAccountId: "allocation-source",
      targetAccountId: "allocation-target",
      amount: Money.fromMinor(6_000n, "EUR"),
    });
    await ledger.repository.saveAllocationPlan(plan);
    await expect(ledger.repository.listAllocationPlans()).resolves.toEqual([plan]);
    const paused = AllocationPlan.create({ ...plan, enabled: false, name: "Directa pausa" });
    await ledger.repository.updateAllocationPlan(paused);
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    await expect(ledger.repository.listAllocationPlans()).resolves.toEqual([paused]);
    await ledger.repository.deleteAllocationPlan(paused.id);
    await expect(ledger.repository.listAllocationPlans()).resolves.toEqual([]);
  });
  it("persiste un budget dopo la riapertura", async () => {
    const budget = Budget.create({
      id: "budget-idb",
      period: "2026-08",
      amount: Money.fromMinor(50_000n, "EUR"),
      firstAlertPercentage: 60,
      secondAlertPercentage: 90,
    });
    await ledger.repository.saveBudget(budget);
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    await expect(ledger.repository.listBudgets()).resolves.toEqual([budget]);
  });
  it("rifiuta budget globali duplicati nello stesso periodo", async () => {
    await ledger.repository.saveBudget(
      Budget.create({
        id: "budget-global-one",
        period: "2026-08",
        amount: Money.fromMinor(50_000n, "EUR"),
        firstAlertPercentage: 80,
        secondAlertPercentage: 100,
      }),
    );
    await expect(
      ledger.repository.saveBudget(
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
  it("persiste un prestito dopo la riapertura", async () => {
    await ledger.repository.saveAccount(account("loan-account", "loan"));
    const loan = Loan.create({
      id: "loan-idb",
      accountId: "loan-account",
      lender: "Agos",
      installment: Money.fromMinor(7_200n, "EUR"),
      remainingPrincipal: Money.fromMinor(200_000n, "EUR"),
    });
    await ledger.repository.saveLoan(loan);
    await ledger.close();
    ledger = await openIndexedDbLedger({ databaseName, factory });
    await expect(ledger.repository.listLoans()).resolves.toEqual([loan]);
  });
  it("rifiuta un prestito senza conto prestito valido", async () => {
    await expect(
      ledger.repository.saveLoan(
        Loan.create({
          id: "loan-missing",
          accountId: "missing",
          lender: "Agos",
          installment: Money.fromMinor(7_200n, "EUR"),
          remainingPrincipal: Money.fromMinor(200_000n, "EUR"),
        }),
      ),
    ).rejects.toMatchObject({ code: "missing_reference" });
  });
  it("rifiuta due prestiti per lo stesso conto", async () => {
    await ledger.repository.saveAccount(account("loan-account", "loan"));
    await ledger.repository.saveLoan(
      Loan.create({
        id: "loan-one",
        accountId: "loan-account",
        lender: "Istituto uno",
        installment: Money.fromMinor(7_200n, "EUR"),
        remainingPrincipal: Money.fromMinor(200_000n, "EUR"),
      }),
    );
    await expect(
      ledger.repository.saveLoan(
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
});
