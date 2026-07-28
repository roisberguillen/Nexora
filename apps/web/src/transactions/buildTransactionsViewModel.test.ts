import { Account, LocalDate, Money, Transaction, Transfer } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { buildTransactionsViewModel } from "./buildTransactionsViewModel";

describe("buildTransactionsViewModel", () => {
  it("collassa le due gambe del trasferimento in una sola riga neutra", () => {
    const source = account("source", "Conto principale");
    const destination = account("destination", "Risparmi");
    const debit = transferLeg("debit", source.id, -12_000n);
    const credit = transferLeg("credit", destination.id, 12_000n);
    const transfer = Transfer.create({
      id: "transfer",
      debitTransaction: debit,
      creditTransaction: credit,
    });
    const income = Transaction.create({
      id: "income",
      kind: "income",
      status: "cancelled",
      accountId: source.id,
      amount: Money.fromMinor(50_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-27"),
    });

    const model = buildTransactionsViewModel({
      accounts: [source, destination],
      categories: [],
      transactions: [debit, credit, income],
      transfers: [transfer],
    });

    expect(model.items).toHaveLength(2);
    expect(model.items[0]).toMatchObject({
      accountLabel: "Conto principale → Risparmi",
      amount: { amountMinor: 12_000n },
      id: transfer.id,
      isTransfer: true,
      kindLabel: "Trasferimento",
    });
    expect(model.items[1]).toMatchObject({ canCancel: false, statusLabel: "Annullato" });
  });
});

function account(id: string, name: string): Account {
  return Account.create({ id, name, type: "checking", currency: "EUR" });
}

function transferLeg(id: string, accountId: string, amountMinor: bigint): Transaction {
  return Transaction.create({
    id,
    kind: "transfer",
    status: "booked",
    accountId,
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate: LocalDate.parse("2026-07-28"),
  });
}
