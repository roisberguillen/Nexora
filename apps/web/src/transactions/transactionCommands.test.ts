import { InMemoryLedgerRepository } from "@nexora/database";
import {
  Account,
  Category,
  LocalDate,
  Money,
  Tag,
  Transaction,
  TransactionSplit,
} from "@nexora/domain";
import { describe, expect, it } from "vitest";

import {
  createManualTransaction,
  createTransfer,
  signedAmountForKind,
  updateManualTransaction,
} from "./transactionCommands";

describe("transaction commands", () => {
  it("crea una spesa con importo firmato e senza floating point", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("main"));

    const transaction = await createManualTransaction(
      repository,
      {
        accountId: "main",
        amountMinor: signedAmountForKind("expense", 90071992547409931234567890n),
        bookedDate: "2026-07-28",
        description: "Spesa demo",
        kind: "expense",
        payee: "Negozio demo",
        status: "booked",
      },
      () => "expense-demo",
    );

    expect(transaction.amount.amountMinor).toBe(-90071992547409931234567890n);
    await expect(repository.findTransactionById(transaction.id)).resolves.toEqual(transaction);
  });

  it("crea un trasferimento con due gambe opposte e protette", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("source"));
    await repository.saveAccount(account("destination", "savings"));

    const transfer = await createTransfer(
      repository,
      {
        amountMinor: 12_345n,
        bookedDate: "2026-07-28",
        creditAccountId: "destination",
        debitAccountId: "source",
        description: "Accantonamento",
        status: "booked",
      },
      (() => {
        let index = 0;
        return () => `transfer-leg-${++index}`;
      })(),
      () => "transfer-demo",
    );

    expect(transfer.debitTransactionId).toBe("transfer-leg-1");
    expect(
      (await repository.findTransactionById(transfer.debitTransactionId))?.amount.amountMinor,
    ).toBe(-12_345n);
    expect(
      (await repository.findTransactionById(transfer.creditTransactionId))?.amount.amountMinor,
    ).toBe(12_345n);
  });

  it("modifica solo un movimento manuale attivo mantenendo la sua identità", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("main"));
    const created = await createManualTransaction(
      repository,
      {
        accountId: "main",
        amountMinor: -1200n,
        bookedDate: "2026-07-28",
        description: "Prima",
        kind: "expense",
        payee: "",
        status: "booked",
      },
      () => "manual-edit",
    );

    const updated = await updateManualTransaction(repository, created.id, {
      accountId: "main",
      amountMinor: -2500n,
      bookedDate: "2026-07-29",
      description: "Dopo",
      kind: "expense",
      payee: "",
      status: "booked",
    });

    expect(updated).toMatchObject({ id: "manual-edit", description: "Dopo" });
    expect(updated.amount.amountMinor).toBe(-2500n);
  });

  it("preserva split e tag quando modifica un movimento manuale", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("main"));
    const category = Category.create({ id: "food", name: "Cibo", kindScope: "expense" });
    const tag = Tag.create({ id: "home", name: "Casa" });
    await repository.saveCategory(category);
    await repository.saveTag(tag);
    const transaction = Transaction.create({
      id: "split-edit",
      kind: "expense",
      status: "booked",
      accountId: "main",
      amount: Money.fromMinor(-2500n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-28"),
      source: "manual",
    });
    const split = TransactionSplit.create({
      id: "split-one",
      transactionId: transaction.id,
      categoryId: category.id,
      amount: Money.fromMinor(-2500n, "EUR"),
    });
    await repository.saveTransactionWithDetails(transaction, [split], [tag.id]);

    await updateManualTransaction(repository, transaction.id, {
      accountId: "main",
      amountMinor: -2500n,
      bookedDate: "2026-07-29",
      description: "Aggiornata",
      kind: "expense",
      payee: "",
      status: "booked",
    });

    expect((await repository.listTransactionSplits(transaction.id)).map((item) => item.id)).toEqual(
      [split.id],
    );
    expect((await repository.listTransactionTags(transaction.id)).map((item) => item.id)).toEqual([
      tag.id,
    ]);
  });

  it("rifiuta conti uguali e valute diverse per un trasferimento", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("eur"));
    await repository.saveAccount(
      Account.create({ id: "usd", name: "Conto USD", type: "savings", currency: "USD" }),
    );

    await expect(
      createTransfer(repository, transferInput({ creditAccountId: "eur", debitAccountId: "eur" })),
    ).rejects.toMatchObject({ code: "invalid_transfer" });
    await expect(
      createTransfer(repository, transferInput({ creditAccountId: "usd", debitAccountId: "eur" })),
    ).rejects.toMatchObject({ code: "currency_mismatch" });
  });
});

function account(id: string, type: "checking" | "savings" = "checking"): Account {
  return Account.create({ id, name: `Conto ${id}`, type, currency: "EUR" });
}

function transferInput(overrides: Partial<{ creditAccountId: string; debitAccountId: string }>) {
  return {
    amountMinor: 100n,
    bookedDate: LocalDate.parse("2026-07-28").value,
    creditAccountId: "destination",
    debitAccountId: "source",
    description: "",
    status: "booked" as const,
    ...overrides,
  };
}
