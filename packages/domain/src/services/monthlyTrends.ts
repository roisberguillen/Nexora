import type { Transaction } from "../entities/Transaction";
import { Money } from "../value-objects/Money";
import { financialPeriodForDate } from "./financialPeriods";

export interface MonthlyTrend {
  readonly month: string;
  readonly income: Money;
  readonly expense: Money;
  readonly savings: Money;
}

export function calculateMonthlyTrends(
  transactions: readonly Transaction[],
  currency: string,
  financialMonthStartDay?: number,
): readonly MonthlyTrend[] {
  const grouped = new Map<string, { income: Money; expense: Money }>();
  for (const transaction of transactions) {
    if (!transaction.affectsIncomeExpense() || transaction.amount.currency !== currency) continue;
    const month = financialPeriodForDate(transaction.bookedDate, financialMonthStartDay);
    const current = grouped.get(month) ?? {
      income: Money.zero(currency),
      expense: Money.zero(currency),
    };
    if (transaction.kind === "income") current.income = current.income.add(transaction.amount);
    if (transaction.kind === "expense")
      current.expense = current.expense.add(transaction.amount.negate());
    grouped.set(month, current);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, value]) =>
      Object.freeze({
        month,
        income: value.income,
        expense: value.expense,
        savings: value.income.subtract(value.expense),
      }),
    );
}
