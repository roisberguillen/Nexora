import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Transaction } from "../entities/Transaction";
import { describe, expect, it } from "vitest";

import { summarizeExpenseBehavior } from "./expenseBehavior";

const expense = (id: string, behavior: Record<string, unknown> = {}) =>
  Transaction.create({
    id,
    kind: "expense",
    status: "booked",
    accountId: "account",
    amount: Money.fromMinor(-1_000n, "EUR"),
    bookedDate: LocalDate.parse("2026-08-08"),
    ...behavior,
  });

describe("expense behavior", () => {
  it("keeps legacy expenses unclassified and aggregates only booked expenses", () => {
    const summary = summarizeExpenseBehavior(
      [
        expense("fixed", { expenseVariability: "fixed", expenseExceptionality: "ordinary" }),
        expense("variable", {
          expenseVariability: "variable",
          expenseExceptionality: "extraordinary",
        }),
        expense("legacy"),
        Transaction.create({
          id: "transfer",
          kind: "transfer",
          status: "booked",
          accountId: "account",
          amount: Money.fromMinor(-1_000n, "EUR"),
          bookedDate: LocalDate.parse("2026-08-08"),
        }),
      ],
      "EUR",
    );
    expect(summary.fixed.amountMinor).toBe(1_000n);
    expect(summary.variable.amountMinor).toBe(1_000n);
    expect(summary.ordinary.amountMinor).toBe(1_000n);
    expect(summary.extraordinary.amountMinor).toBe(1_000n);
    expect(summary.unclassified.amountMinor).toBe(1_000n);
  });
});
