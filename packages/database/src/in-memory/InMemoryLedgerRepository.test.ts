import {
  Account,
  Category,
  DomainError,
  LocalDate,
  Money,
  Tag,
  Transaction,
  TransactionSplit,
  Transfer,
} from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { InMemoryLedgerRepository } from "./InMemoryLedgerRepository";

const bookedDate = LocalDate.parse("2026-07-27");

function account(id: string, type: "checking" | "savings" = "checking") {
  return Account.create({
    id,
    name: `Conto ${id}`,
    type,
    currency: "EUR",
  });
}

function transferLeg(id: string, accountId: string, amountMinor: bigint) {
  return Transaction.create({
    id,
    kind: "transfer",
    status: "booked",
    accountId,
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate,
  });
}

describe("InMemoryLedgerRepository", () => {
  it("persiste tag attivi e le loro associazioni alla transazione", async () => {
    const repository = new InMemoryLedgerRepository();
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

    const archivedTag = tag.update({ name: tag.name, isArchived: true });
    await repository.updateTag(archivedTag);
    await expect(repository.setTransactionTags(transaction.id, [tag.id])).rejects.toMatchObject({
      code: "missing_reference",
    });
    expect(await repository.listTransactionTags(transaction.id)).toEqual([archivedTag]);
  });

  it("verifica riferimenti di conti, categorie e sottoconti", async () => {
    const repository = new InMemoryLedgerRepository();
    const main = account("account-main");
    const category = Category.create({
      id: "category-demo",
      name: "Categoria Demo",
      kindScope: "expense",
    });

    await repository.saveAccount(main);
    await repository.saveCategory(category);
    await repository.saveAccount(
      Account.create({
        id: "space-demo",
        name: "Spazio Demo",
        type: "virtual_subaccount",
        currency: "EUR",
        parentAccountId: main.id,
      }),
    );
    await repository.saveTransaction(
      Transaction.create({
        id: "expense-demo",
        kind: "expense",
        status: "booked",
        accountId: main.id,
        amount: Money.fromMinor(-1_500n, "EUR"),
        bookedDate,
        categoryId: category.id,
      }),
    );

    expect(await repository.listAccounts()).toHaveLength(2);
    expect(await repository.listTransactions()).toHaveLength(1);
  });

  it("salva trasferimento e gambe con un singolo commit logico", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("account-a"));
    await repository.saveAccount(account("account-b", "savings"));
    const debitTransaction = transferLeg("debit-demo", "account-a", -10_000n);
    const creditTransaction = transferLeg("credit-demo", "account-b", 10_000n);
    const transfer = Transfer.create({
      id: "transfer-demo",
      debitTransaction,
      creditTransaction,
    });

    await repository.saveTransfer({ transfer, debitTransaction, creditTransaction });

    expect(await repository.findTransferById(transfer.id)).toBe(transfer);
    expect(await repository.listTransactions()).toEqual([debitTransaction, creditTransaction]);
  });

  it("non lascia una gamba parziale quando la prevalidazione fallisce", async () => {
    const repository = new InMemoryLedgerRepository();
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
      repository.saveTransfer({ transfer, debitTransaction, creditTransaction }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(await repository.findTransactionById(debitTransaction.id)).toBeUndefined();
    expect(await repository.findTransferById(transfer.id)).toBeUndefined();
    expect(await repository.listTransactions()).toHaveLength(1);
  });

  it("impedisce di salvare una gamba transfer senza il collegamento", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("account-a"));

    await expect(
      repository.saveTransaction(transferLeg("orphan-leg", "account-a", -100n)),
    ).rejects.toMatchObject({ code: "invalid_transfer" });
  });

  it("impedisce di assegnare una categoria con scope incompatibile", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("account-a"));
    await repository.saveCategory(
      Category.create({
        id: "income-only",
        name: "Entrate Demo",
        kindScope: "income",
      }),
    );

    const expense = Transaction.create({
      id: "expense-wrong-category",
      kind: "expense",
      status: "booked",
      accountId: "account-a",
      amount: Money.fromMinor(-100n, "EUR"),
      bookedDate,
      categoryId: "income-only",
    });

    await expect(repository.saveTransaction(expense)).rejects.toMatchObject({
      code: "invalid_category",
    });
    expect(await repository.findTransactionById(expense.id)).toBeUndefined();
  });

  it("annulla un movimento singolo e conserva i trasferimenti come bundle atomico", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("account-a"));
    await repository.saveAccount(account("account-b", "savings"));
    const income = Transaction.create({
      id: "income-cancellable",
      kind: "income",
      status: "booked",
      accountId: "account-a",
      amount: Money.fromMinor(500n, "EUR"),
      bookedDate,
    });
    await repository.saveTransaction(income);
    await repository.cancelTransaction(income.id);
    await expect(repository.findTransactionById(income.id)).resolves.toMatchObject({
      status: "cancelled",
    });

    const debitTransaction = transferLeg("transfer-debit-cancel", "account-a", -100n);
    const creditTransaction = transferLeg("transfer-credit-cancel", "account-b", 100n);
    const transfer = Transfer.create({
      id: "transfer-cancellable",
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

  it("salva atomicamente una spesa ripartita e rifiuta categorie archiviate", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("split-account"));
    await repository.saveCategory(
      Category.create({ id: "split-food", name: "Cibo", kindScope: "expense" }),
    );
    await repository.saveCategory(
      Category.create({
        id: "split-archived",
        name: "Archivio",
        kindScope: "expense",
        isArchived: true,
      }),
    );
    const transaction = Transaction.create({
      id: "split-expense",
      kind: "expense",
      status: "booked",
      accountId: "split-account",
      amount: Money.fromMinor(-1000n, "EUR"),
      bookedDate,
    });
    const valid = TransactionSplit.create({
      id: "split-valid",
      transactionId: transaction.id,
      categoryId: "split-food",
      amount: Money.fromMinor(-1000n, "EUR"),
    });
    await repository.saveTransactionWithSplits(transaction, [valid]);
    await expect(repository.listTransactionSplits(transaction.id)).resolves.toEqual([valid]);
    const rejected = Transaction.create({
      id: "split-rejected",
      kind: "expense",
      status: "booked",
      accountId: "split-account",
      amount: Money.fromMinor(-10n, "EUR"),
      bookedDate,
    });
    await expect(
      repository.saveTransactionWithSplits(rejected, [
        TransactionSplit.create({
          id: "split-invalid",
          transactionId: rejected.id,
          categoryId: "split-archived",
          amount: Money.fromMinor(-10n, "EUR"),
        }),
      ]),
    ).rejects.toMatchObject({ code: "invalid_category" });
    await expect(repository.findTransactionById(rejected.id)).resolves.toBeUndefined();
  });

  it("aggiorna i campi mutabili e protegge il saldo iniziale dopo i movimenti", async () => {
    const repository = new InMemoryLedgerRepository();
    const original = Account.create({
      id: "account-a",
      name: "Conto originale",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(10_000n, "EUR"),
    });
    await repository.saveAccount(original);
    await repository.updateAccount(
      original.update({
        name: "Conto aggiornato",
        openingBalance: Money.fromMinor(12_500n, "EUR"),
      }),
    );

    const updated = await repository.findAccountById(original.id);
    expect(updated?.name).toBe("Conto aggiornato");
    expect(updated?.openingBalance.amountMinor).toBe(12_500n);
    if (updated === undefined) {
      throw new Error("Updated account was not persisted.");
    }

    await repository.saveTransaction(
      Transaction.create({
        id: "income-demo",
        kind: "income",
        status: "booked",
        accountId: original.id,
        amount: Money.fromMinor(500n, "EUR"),
        bookedDate,
      }),
    );
    await expect(
      repository.updateAccount(updated.update({ openingBalance: Money.fromMinor(15_000n, "EUR") })),
    ).rejects.toMatchObject({ code: "invalid_account" });
    expect((await repository.findAccountById(original.id))?.openingBalance.amountMinor).toBe(
      12_500n,
    );
  });

  it("richiede di archiviare i sottoconti prima del conto padre", async () => {
    const repository = new InMemoryLedgerRepository();
    const parent = account("account-main");
    const space = Account.create({
      id: "space-demo",
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

    expect((await repository.findAccountById(parent.id))?.isArchived).toBe(true);
    await expect(
      repository.updateAccount(space.update({ isArchived: false })),
    ).rejects.toMatchObject({ code: "invalid_account" });
    await expect(
      repository.saveAccount(
        Account.create({
          id: "space-new",
          name: "Nuovo spazio",
          type: "virtual_subaccount",
          currency: "EUR",
          parentAccountId: parent.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_account" });
  });
});
