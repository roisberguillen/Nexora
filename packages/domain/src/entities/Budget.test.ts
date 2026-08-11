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
  it("accepts ordered alert percentages and rejects invalid pairs", () => {
    const valid = Budget.create({
      id: "valid-thresholds",
      period: "2026-08",
      categoryId: "food",
      amount: Money.fromMinor(10_000n, "EUR"),
      firstAlertPercentage: 45,
      secondAlertPercentage: 85,
    });
    expect(valid.firstAlertPercentage).toBe(45);
    expect(valid.secondAlertPercentage).toBe(85);

    for (const [firstAlertPercentage, secondAlertPercentage] of [
      [0, 80],
      [80, 0],
      [101, 100],
      [80, 80],
      [90, 80],
    ] as const) {
      expect(() =>
        Budget.create({
          id: `invalid-${firstAlertPercentage}-${secondAlertPercentage}`,
          period: "2026-08",
          categoryId: "food",
          amount: Money.fromMinor(10_000n, "EUR"),
          firstAlertPercentage,
          secondAlertPercentage,
        }),
      ).toThrow(/percentage/i);
    }
  });

  it("keeps a legacy budget without configured alerts readable", () => {
    const legacy = Budget.restore({
      id: "legacy-budget",
      period: "2026-08",
      amount: Money.fromMinor(10_000n, "EUR"),
    });
    expect(legacy.firstAlertPercentage).toBeUndefined();
    expect(legacy.secondAlertPercentage).toBeUndefined();
  });

  it("calcola solo le spese contabilizzate della categoria e del periodo", () => {
    const budget = Budget.create({
      id: "food-august",
      period: "2026-08",
      categoryId: "food",
      amount: Money.fromMinor(10_000n, "EUR"),
      firstAlertPercentage: 80,
      secondAlertPercentage: 100,
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
