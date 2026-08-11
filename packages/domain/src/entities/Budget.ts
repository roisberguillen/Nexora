import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";
import { Money } from "../value-objects/Money";
import type { Transaction } from "./Transaction";

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface CreateBudgetProps {
  readonly id: string;
  /** Stable logical configuration id. A revision id remains immutable. */
  readonly seriesId?: string;
  /** Effective-from period. The persisted name is retained for archive compatibility. */
  readonly period: string;
  /** Exclusive effective-to period. Undefined means the configuration continues. */
  readonly effectiveToPeriod?: string;
  readonly amount: Money;
  readonly categoryId?: string;
  readonly firstAlertPercentage: number;
  readonly secondAlertPercentage: number;
}

/**
 * Compatibility input used only when reading a budget written before configurable
 * thresholds existed. New budgets must use `create`.
 */
export interface RestoreBudgetProps {
  readonly id: string;
  readonly seriesId?: string;
  readonly period: string;
  readonly effectiveToPeriod?: string;
  readonly amount: Money;
  readonly categoryId?: string;
  readonly firstAlertPercentage?: number;
  readonly secondAlertPercentage?: number;
}

export class Budget {
  public readonly id: string;
  public readonly seriesId: string;
  public readonly period: string;
  public readonly effectiveToPeriod: string | undefined;
  public readonly amount: Money;
  public readonly categoryId: string | undefined;
  public readonly firstAlertPercentage: number | undefined;
  public readonly secondAlertPercentage: number | undefined;

  private constructor(props: RestoreBudgetProps) {
    this.id = requireIdentifier(props.id, "Budget id");
    this.seriesId = requireIdentifier(props.seriesId ?? props.id, "Budget series id");
    this.period = requirePeriod(props.period);
    this.effectiveToPeriod =
      props.effectiveToPeriod === undefined ? undefined : requirePeriod(props.effectiveToPeriod);
    if (this.effectiveToPeriod !== undefined && this.period >= this.effectiveToPeriod) {
      throw new DomainError(
        "invalid_date",
        "Budget effective-to period must be after its effective-from period.",
      );
    }
    this.amount = props.amount;
    this.categoryId =
      props.categoryId === undefined
        ? undefined
        : requireIdentifier(props.categoryId, "Budget category id");
    this.firstAlertPercentage = props.firstAlertPercentage;
    this.secondAlertPercentage = props.secondAlertPercentage;
    if (!this.amount.isPositive())
      throw new DomainError("invalid_money", "Budget amount must be positive.");
    assertAlertThresholds(this.firstAlertPercentage, this.secondAlertPercentage);
    Object.freeze(this);
  }

  public static create(props: CreateBudgetProps): Budget {
    return new Budget(props);
  }

  public static restore(props: RestoreBudgetProps): Budget {
    return new Budget(props);
  }

  public spentBy(transactions: readonly Transaction[]): Money {
    return transactions.reduce((spent, transaction) => {
      if (
        transaction.kind !== "expense" ||
        (transaction.status !== "booked" && transaction.status !== "reconciled") ||
        transaction.bookedDate.toString().slice(0, 7) !== this.period ||
        (this.categoryId !== undefined && transaction.categoryId !== this.categoryId)
      ) {
        return spent;
      }
      return spent.add(transaction.amount.negate());
    }, Money.zero(this.amount.currency));
  }

  public usagePercent(transactions: readonly Transaction[]): number {
    const spent = this.spentBy(transactions);
    if (spent.currency !== this.amount.currency)
      throw new DomainError(
        "currency_mismatch",
        "Budget transactions must share the budget currency.",
      );
    return Number((spent.amountMinor * 10_000n) / this.amount.amountMinor) / 100;
  }
}

/** YYYY-MM comparison is chronological because months are zero-padded. */
export function compareBudgetPeriods(left: string, right: string): number {
  return requirePeriod(left).localeCompare(requirePeriod(right));
}

export function nextBudgetPeriod(period: string): string {
  const value = requirePeriod(period);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function previousBudgetPeriod(period: string): string {
  const value = requirePeriod(period);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function isBudgetEffectiveForPeriod(budget: Budget, period: string): boolean {
  const target = requirePeriod(period);
  return (
    budget.period <= target &&
    (budget.effectiveToPeriod === undefined || target < budget.effectiveToPeriod)
  );
}

/** Resolves the only effective revision in a logical budget series. */
export function resolveBudgetForPeriod(
  budgets: readonly Budget[],
  seriesId: string,
  period: string,
): Budget | undefined {
  const matches = budgets.filter(
    (budget) => budget.seriesId === seriesId && isBudgetEffectiveForPeriod(budget, period),
  );
  if (matches.length > 1) {
    throw new DomainError("duplicate_entity", "Budget revisions overlap for the requested period.");
  }
  return matches[0];
}

/** Resolves all visible budget configurations for a month, including legacy global budgets. */
export function resolveActiveBudgetsForPeriod(
  budgets: readonly Budget[],
  period: string,
): readonly Budget[] {
  return budgets.filter((budget) => isBudgetEffectiveForPeriod(budget, period));
}

function assertAlertThresholds(first: number | undefined, second: number | undefined): void {
  for (const [name, value] of [
    ["Budget first alert percentage", first],
    ["Budget second alert percentage", second],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value <= 0 || value > 100)) {
      throw new DomainError("invalid_percentage", `${name} must be an integer between 1 and 100.`);
    }
  }
  if (first !== undefined && second !== undefined && first >= second) {
    throw new DomainError(
      "invalid_percentage",
      "Budget first alert percentage must be lower than the second alert percentage.",
    );
  }
}

function requirePeriod(value: string): string {
  if (!periodPattern.test(value))
    throw new DomainError("invalid_date", "Budget period must use the YYYY-MM format.");
  return value;
}
