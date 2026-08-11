import { DomainError } from "../errors/DomainError";
import type { Budget } from "../entities/Budget";
import type { Category } from "../entities/Category";
import type { Transaction } from "../entities/Transaction";
import type { TransactionSplit } from "../entities/TransactionSplit";
import { Money } from "../value-objects/Money";

export type BudgetProgressStatus = "normal" | "warning" | "exceeded";

export interface BudgetCategoryScope {
  readonly categoryIds: ReadonlySet<string> | undefined;
  readonly includesDescendants: boolean;
}

export interface BudgetCategoryBreakdown {
  readonly categoryId: string;
  readonly spent: Money;
}

export interface BudgetProgress {
  readonly limit: Money;
  readonly spent: Money;
  readonly remaining: Money;
  readonly percentage: number;
  readonly status: BudgetProgressStatus;
  readonly scope: BudgetCategoryScope;
  readonly breakdown: readonly BudgetCategoryBreakdown[];
}

/** Resolves the budget category once so UI and future analytics never reimplement hierarchy rules. */
export function resolveBudgetCategoryScope(
  budget: Budget,
  categories: readonly Category[],
): BudgetCategoryScope {
  if (budget.categoryId === undefined) {
    return { categoryIds: undefined, includesDescendants: false };
  }
  const selected = categories.find((category) => category.id === budget.categoryId);
  if (selected === undefined) {
    return { categoryIds: new Set([budget.categoryId]), includesDescendants: false };
  }
  const categoryIds = new Set<string>([selected.id]);
  const pending = [selected.id];
  while (pending.length > 0) {
    const parentId = pending.pop();
    for (const category of categories) {
      if (category.parentId === parentId && !categoryIds.has(category.id)) {
        categoryIds.add(category.id);
        pending.push(category.id);
      }
    }
  }
  return { categoryIds, includesDescendants: categoryIds.size > 1 };
}

/**
 * Calculates booked expense consumption in minor units. A split transaction contributes only its
 * split rows; its category-less parent is never counted a second time.
 */
export function calculateBudgetProgress({
  budget,
  categories,
  transactions,
  splits,
}: {
  readonly budget: Budget;
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly splits: readonly TransactionSplit[];
}): BudgetProgress {
  const scope = resolveBudgetCategoryScope(budget, categories);
  const splitsByTransaction = new Map<string, TransactionSplit[]>();
  for (const split of splits) {
    const rows = splitsByTransaction.get(split.transactionId) ?? [];
    rows.push(split);
    splitsByTransaction.set(split.transactionId, rows);
  }
  const breakdown = new Map<string, Money>();
  let spent = Money.zero(budget.amount.currency);
  for (const transaction of transactions) {
    if (
      transaction.kind !== "expense" ||
      !transaction.affectsIncomeExpense() ||
      (transaction.status !== "booked" && transaction.status !== "reconciled") ||
      transaction.bookedDate.toString().slice(0, 7) !== budget.period
    ) {
      continue;
    }
    const transactionSplits = splitsByTransaction.get(transaction.id);
    if (transactionSplits !== undefined && transactionSplits.length > 0) {
      for (const split of transactionSplits) {
        if (scope.categoryIds !== undefined && !scope.categoryIds.has(split.categoryId)) continue;
        if (split.amount.currency !== budget.amount.currency) {
          throw new DomainError(
            "currency_mismatch",
            "Budget splits must share the budget currency.",
          );
        }
        const amount = split.amount.negate();
        spent = spent.add(amount);
        breakdown.set(
          split.categoryId,
          (breakdown.get(split.categoryId) ?? Money.zero(amount.currency)).add(amount),
        );
      }
      continue;
    }
    if (scope.categoryIds !== undefined && !scope.categoryIds.has(transaction.categoryId ?? ""))
      continue;
    if (transaction.amount.currency !== budget.amount.currency) {
      throw new DomainError(
        "currency_mismatch",
        "Budget transactions must share the budget currency.",
      );
    }
    const amount = transaction.amount.negate();
    spent = spent.add(amount);
    if (transaction.categoryId !== undefined) {
      breakdown.set(
        transaction.categoryId,
        (breakdown.get(transaction.categoryId) ?? Money.zero(amount.currency)).add(amount),
      );
    }
  }
  const percentage = Number((spent.amountMinor * 10_000n) / budget.amount.amountMinor) / 100;
  return {
    limit: budget.amount,
    spent,
    remaining: budget.amount.subtract(spent),
    percentage,
    status: percentage >= 100 ? "exceeded" : percentage >= 80 ? "warning" : "normal",
    scope,
    breakdown: [...breakdown.entries()]
      .map(([categoryId, categorySpent]) => ({ categoryId, spent: categorySpent }))
      .sort((left, right) =>
        right.spent.amountMinor === left.spent.amountMinor
          ? left.categoryId.localeCompare(right.categoryId)
          : right.spent.amountMinor > left.spent.amountMinor
            ? 1
            : -1,
      ),
  };
}
