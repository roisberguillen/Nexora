import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Transaction } from "./Transaction";
import { Budget } from "./Budget";

const expense = (id: string, amountMinor: bigint, categoryId: string, status = "booked") =>
  Transaction.create({
    id,
    kind: "expense",
    status: status as "booked" | "cancelled",
    accountId: "main",
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate: LocalDate.parse("2026-08-15"),
    categoryId,
  });

describe("Budget", () => {
  it("calcola solo le spese contabilizzate della categoria e del periodo", () => {
    const budget = Budget.create({
      id: "food-august",
      period: "2026-08",
      categoryId: "food",
      amount: Money.fromMinor(10_000n, "EUR"),
    });
    const income = Transaction.create({
      id: "income",
      kind: "income",
      status: "booked",
      accountId: "main",
      amount: Money.fromMinor(5_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-08-15"),
    });
    expect(
      budget.spentBy([
        expense("food", -8_000n, "food"),
        expense("other", -1_000n, "other"),
        income,
        expense("cancelled", -2_000n, "food", "cancelled"),
      ]).amountMinor,
    ).toBe(8_000n);
    expect(budget.usagePercent([expense("food", -8_000n, "food")])).toBe(80);
  });
});
