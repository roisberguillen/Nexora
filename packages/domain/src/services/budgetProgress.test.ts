import { describe, expect, it } from "vitest";

import { Budget } from "../entities/Budget";
import { Category } from "../entities/Category";
import { Transaction } from "../entities/Transaction";
import { TransactionSplit } from "../entities/TransactionSplit";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { calculateBudgetProgress } from "./budgetProgress";

const category = (id: string, parentId?: string, isArchived = false) =>
  Category.create({
    id,
    name: id,
    kindScope: "expense",
    ...(parentId === undefined ? {} : { parentId }),
    isArchived,
  });
const expense = (
  id: string,
  amountMinor: bigint,
  date: string,
  categoryId?: string,
  status: "expected" | "booked" | "reconciled" | "cancelled" = "booked",
) =>
  Transaction.create({
    id,
    kind: "expense",
    status,
    accountId: "account",
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate: LocalDate.parse(date),
    ...(categoryId === undefined ? {} : { categoryId }),
  });
const budget = (categoryId?: string, period = "2026-02", amountMinor = 50_000n) =>
  Budget.create({
    id: `budget-${categoryId ?? "all"}-${period}`,
    period,
    amount: Money.fromMinor(amountMinor, "EUR"),
    firstAlertPercentage: 80,
    secondAlertPercentage: 100,
    ...(categoryId === undefined ? {} : { categoryId }),
  });

describe("calculateBudgetProgress", () => {
  const categories = [
    category("transport"),
    category("fuel", "transport"),
    category("parking", "transport"),
    category("archived", "transport", true),
    category("food"),
  ];

  it("aggregates a macro category, including archived children, without siblings", () => {
    const progress = calculateBudgetProgress({
      budget: budget("transport"),
      targetPeriod: "2026-02",
      categories,
      transactions: [
        expense("fuel", -18_000n, "2026-02-01", "fuel"),
        expense("parking", -3_000n, "2026-02-28", "parking"),
        expense("old", -2_000n, "2026-02-28", "archived"),
        expense("food", -5_000n, "2026-02-28", "food"),
      ],
      splits: [],
    });
    expect(progress.spent.amountMinor).toBe(23_000n);
    expect(progress.remaining.amountMinor).toBe(27_000n);
    expect(progress.percentage).toBe(46);
    expect(progress.scope.includesDescendants).toBe(true);
  });

  it("attributes split expenses once to their selected categories", () => {
    const splitParent = expense("split", -10_000n, "2026-02-15");
    const splits = [
      TransactionSplit.create({
        id: "fuel-split",
        transactionId: "split",
        categoryId: "fuel",
        amount: Money.fromMinor(-6_000n, "EUR"),
      }),
      TransactionSplit.create({
        id: "food-split",
        transactionId: "split",
        categoryId: "food",
        amount: Money.fromMinor(-4_000n, "EUR"),
      }),
    ];
    expect(
      calculateBudgetProgress({
        budget: budget("fuel"),
        targetPeriod: "2026-02",
        categories,
        transactions: [splitParent],
        splits,
      }).spent.amountMinor,
    ).toBe(6_000n);
    expect(
      calculateBudgetProgress({
        budget: budget("food"),
        targetPeriod: "2026-02",
        categories,
        transactions: [splitParent],
        splits,
      }).spent.amountMinor,
    ).toBe(4_000n);
    expect(
      calculateBudgetProgress({
        budget: budget("transport"),
        targetPeriod: "2026-02",
        categories,
        transactions: [splitParent],
        splits,
      }).spent.amountMinor,
    ).toBe(6_000n);
  });

  it("excludes income, transfers, adjustments, cancelled and expected expenses", () => {
    const income = Transaction.create({
      id: "income",
      kind: "income",
      status: "booked",
      accountId: "account",
      amount: Money.fromMinor(10_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-02-01"),
      categoryId: "food",
    });
    const transfer = Transaction.create({
      id: "transfer",
      kind: "transfer",
      status: "booked",
      accountId: "account",
      amount: Money.fromMinor(-10_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-02-01"),
    });
    const adjustment = Transaction.create({
      id: "adjustment",
      kind: "adjustment",
      status: "booked",
      accountId: "account",
      amount: Money.fromMinor(-10_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-02-01"),
      categoryId: "food",
    });
    const progress = calculateBudgetProgress({
      budget: budget("food"),
      targetPeriod: "2026-02",
      categories,
      transactions: [
        income,
        transfer,
        adjustment,
        expense("expected", -1_000n, "2026-02-01", "food", "expected"),
        expense("cancelled", -1_000n, "2026-02-01", "food", "cancelled"),
        expense("included", -5_000n, "2026-02-28", "food"),
        expense("prior", -5_000n, "2026-01-31", "food"),
        expense("next", -5_000n, "2026-03-01", "food"),
      ],
      splits: [],
    });
    expect(progress.spent.amountMinor).toBe(5_000n);
    expect(progress.status).toBe("normal");
  });

  it("keeps negative remaining money when the budget is exceeded", () => {
    const progress = calculateBudgetProgress({
      budget: budget("food", "2026-12", 50_000n),
      targetPeriod: "2026-12",
      categories,
      transactions: [expense("year-end", -55_000n, "2026-12-31", "food")],
      splits: [],
    });
    expect(progress.remaining.amountMinor).toBe(-5_000n);
    expect(progress.percentage).toBe(110);
    expect(progress.status).toBe("over_budget");
  });
});
