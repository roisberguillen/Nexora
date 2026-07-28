import { calculateMonthlyTrends } from "./monthlyTrends";
import type { Transaction } from "../entities/Transaction";
import { Money } from "../value-objects/Money";

export interface PrudentForecast {
  readonly method: "monthly_expense_median";
  readonly expectedExpense: Money;
  readonly lowerExpense: Money;
  readonly upperExpense: Money;
  readonly historyMonths: number;
}

export function calculatePrudentExpenseForecast(
  transactions: readonly Transaction[],
  currency: string,
): PrudentForecast {
  const expenses = calculateMonthlyTrends(transactions, currency)
    .map((trend) => trend.expense.amountMinor)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const median = expenses.length === 0 ? 0n : expenses[Math.floor((expenses.length - 1) / 2)]!;
  const margin = median / 10n;
  return Object.freeze({
    method: "monthly_expense_median",
    expectedExpense: Money.fromMinor(median, currency),
    lowerExpense: Money.fromMinor(median > margin ? median - margin : 0n, currency),
    upperExpense: Money.fromMinor(median + margin, currency),
    historyMonths: expenses.length,
  });
}
