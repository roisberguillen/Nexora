import { describe, expect, it } from "vitest";

import { Transaction } from "./Transaction";
import { TransactionSplit, validateTransactionSplits } from "./TransactionSplit";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";

describe("TransactionSplit", () => {
  it("richiede una ripartizione esatta con segno e valuta della transazione", () => {
    const transaction = Transaction.create({
      id: "expense",
      kind: "expense",
      status: "booked",
      accountId: "account",
      amount: Money.fromMinor(-1000n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-28"),
    });
    const first = TransactionSplit.create({
      id: "first",
      transactionId: transaction.id,
      categoryId: "food",
      amount: Money.fromMinor(-700n, "EUR"),
    });
    const second = TransactionSplit.create({
      id: "second",
      transactionId: transaction.id,
      categoryId: "house",
      amount: Money.fromMinor(-300n, "EUR"),
    });
    expect(() => validateTransactionSplits(transaction, [first, second])).not.toThrow();
    expect(() => validateTransactionSplits(transaction, [first])).toThrow(/total/i);
    expect(() =>
      validateTransactionSplits(transaction, [
        TransactionSplit.create({
          id: "wrong",
          transactionId: transaction.id,
          categoryId: "food",
          amount: Money.fromMinor(1000n, "EUR"),
        }),
      ]),
    ).toThrow();
  });

  it("rifiuta transfer, adjustment e transazioni annullate", () => {
    const split = TransactionSplit.create({
      id: "split",
      transactionId: "transaction",
      categoryId: "food",
      amount: Money.fromMinor(-10n, "EUR"),
    });
    for (const [kind, status] of [
      ["transfer", "booked"],
      ["adjustment", "booked"],
      ["expense", "cancelled"],
    ] as const) {
      const transaction = Transaction.create({
        id: "transaction",
        kind,
        status,
        accountId: "account",
        amount: Money.fromMinor(-10n, "EUR"),
        bookedDate: LocalDate.parse("2026-07-28"),
      });
      expect(() => validateTransactionSplits(transaction, [split])).toThrow();
    }
  });
});
