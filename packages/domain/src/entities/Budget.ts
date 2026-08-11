import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";
import { Money } from "../value-objects/Money";
import type { Transaction } from "./Transaction";

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface CreateBudgetProps {
  readonly id: string;
  readonly period: string;
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
  readonly period: string;
  readonly amount: Money;
  readonly categoryId?: string;
  readonly firstAlertPercentage?: number;
  readonly secondAlertPercentage?: number;
}

export class Budget {
  public readonly id: string;
  public readonly period: string;
  public readonly amount: Money;
  public readonly categoryId: string | undefined;
  public readonly firstAlertPercentage: number | undefined;
  public readonly secondAlertPercentage: number | undefined;

  private constructor(props: RestoreBudgetProps) {
    this.id = requireIdentifier(props.id, "Budget id");
    this.period = requirePeriod(props.period);
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
