import { Category, LocalDate, Money, Transaction, TransactionSplit } from "@nexora/domain";
import { describe, expect, it } from "vitest";
import { buildAnalyticsViewModel } from "./buildAnalyticsViewModel";

const category = (id: string, name: string, parentId?: string) =>
  Category.create({
    id,
    name,
    kindScope: "expense",
    ...(parentId === undefined ? {} : { parentId }),
  });

const transaction = (
  id: string,
  kind: "income" | "expense" | "transfer",
  amountMinor: bigint,
  date: string,
  categoryId?: string,
  status: "booked" | "cancelled" = "booked",
) =>
  Transaction.create({
    id,
    kind,
    status,
    accountId: "account",
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate: LocalDate.parse(date),
    ...(categoryId === undefined ? {} : { categoryId }),
  });

describe("buildAnalyticsViewModel", () => {
  it("uses the selected month for every summary and provides 3/6/12 month windows", () => {
    const model = buildAnalyticsViewModel(
      {
        categories: [],
        transactionSplits: [],
        transactions: [
          transaction("income-jul", "income", 100_000n, "2026-07-01"),
          transaction("expense-jul", "expense", -20_000n, "2026-07-02"),
          transaction("income-aug", "income", 120_000n, "2026-08-01"),
          transaction("expense-aug", "expense", -30_000n, "2026-08-02"),
        ],
      },
      "2026-08",
      3,
    );

    expect(model.monthlySummary.income.amountMinor).toBe(120_000n);
    expect(model.monthlySummary.expense.amountMinor).toBe(30_000n);
    expect(model.monthlySummary.net.amountMinor).toBe(90_000n);
    expect(model.trends).toHaveLength(3);
    expect(model.savingRatePercent).toBe(75);
  });

  it("aggregates splits once, excludes cancelled/transfers and stays zero-safe", () => {
    const parent = category("home", "Casa");
    const food = category("food", "Spesa", parent.id);
    const leisure = category("leisure", "Svago", parent.id);
    const splitTransaction = transaction("split", "expense", -10_000n, "2026-08-03");
    const model = buildAnalyticsViewModel(
      {
        categories: [parent, food, leisure],
        transactions: [
          splitTransaction,
          transaction("cancelled", "expense", -50_000n, "2026-08-04", food.id, "cancelled"),
          transaction("transfer", "transfer", -80_000n, "2026-08-05"),
        ],
        transactionSplits: [
          TransactionSplit.create({
            id: "split-food",
            transactionId: splitTransaction.id,
            categoryId: food.id,
            amount: Money.fromMinor(-7_000n, "EUR"),
          }),
          TransactionSplit.create({
            id: "split-leisure",
            transactionId: splitTransaction.id,
            categoryId: leisure.id,
            amount: Money.fromMinor(-3_000n, "EUR"),
          }),
        ],
      },
      "2026-08",
      6,
    );

    expect(model.monthlySummary.expense.amountMinor).toBe(10_000n);
    expect(model.categories.map((item) => item.amount.amountMinor)).toEqual([7_000n, 3_000n]);
    expect(model.categories[0]?.percentage).toBe(70);
    expect(model.savingRatePercent).toBeUndefined();
  });
});
