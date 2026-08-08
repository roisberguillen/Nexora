import type { Transaction } from "../entities/Transaction";
import { Money } from "../value-objects/Money";

export interface ExpenseBehaviorSummary {
  readonly fixed: Money;
  readonly variable: Money;
  readonly ordinary: Money;
  readonly extraordinary: Money;
  readonly unclassified: Money;
}

/** Future analytics contract; transfers, adjustments, cancellations and legacy ambiguity stay out. */
export function summarizeExpenseBehavior(
  transactions: readonly Transaction[],
  currency: string,
): ExpenseBehaviorSummary {
  let fixed = Money.zero(currency);
  let variable = Money.zero(currency);
  let ordinary = Money.zero(currency);
  let extraordinary = Money.zero(currency);
  let unclassified = Money.zero(currency);
  for (const transaction of transactions) {
    if (
      !transaction.affectsIncomeExpense() ||
      transaction.kind !== "expense" ||
      transaction.amount.currency !== currency
    ) {
      continue;
    }
    const amount = transaction.amount.negate();
    if (transaction.expenseVariability === "fixed") fixed = fixed.add(amount);
    else if (transaction.expenseVariability === "variable") variable = variable.add(amount);
    else unclassified = unclassified.add(amount);
    if (transaction.expenseExceptionality === "ordinary") ordinary = ordinary.add(amount);
    else if (transaction.expenseExceptionality === "extraordinary") {
      extraordinary = extraordinary.add(amount);
    }
  }
  return Object.freeze({ fixed, variable, ordinary, extraordinary, unclassified });
}
