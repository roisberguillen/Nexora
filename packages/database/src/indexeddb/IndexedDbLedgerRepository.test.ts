// @vitest-environment node

import { Account, Category, LocalDate, Money, Transaction, Transfer } from "@nexora/domain";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IndexedDbLedger } from "./openIndexedDbLedger";
import { seedDemoLedger } from "../seed/demoLedgerSeed";
import { INDEXED_DB_SCHEMA_VERSION, openIndexedDbLedger } from "./openIndexedDbLedger";

const bookedDate = LocalDate.parse("2026-07-27");

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

  it("crea atomicamente lo schema v1 con indici e metadati", async () => {
    expect(ledger.schemaVersion).toBe(INDEXED_DB_SCHEMA_VERSION);
    expect([...ledger.database.objectStoreNames]).toEqual([
      "accounts",
      "categories",
      "metadata",
      "tags",
      "transaction_splits",
      "transaction_tags",
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

    expect(metadata).toEqual({ key: "schema_version", value: 2 });
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

    expect(ledger.schemaVersion).toBe(3);
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
});
