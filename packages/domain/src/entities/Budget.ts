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
  readonly alertAt80?: boolean;
  readonly alertAt100?: boolean;
}

export class Budget {
  public readonly id: string;
  public readonly period: string;
  public readonly amount: Money;
  public readonly categoryId: string | undefined;
  public readonly alertAt80: boolean;
  public readonly alertAt100: boolean;

  private constructor(props: CreateBudgetProps) {
    this.id = requireIdentifier(props.id, "Budget id");
    this.period = requirePeriod(props.period);
    this.amount = props.amount;
    this.categoryId =
      props.categoryId === undefined
        ? undefined
        : requireIdentifier(props.categoryId, "Budget category id");
    this.alertAt80 = props.alertAt80 ?? true;
    this.alertAt100 = props.alertAt100 ?? true;
    if (!this.amount.isPositive())
      throw new DomainError("invalid_money", "Budget amount must be positive.");
    Object.freeze(this);
  }

  public static create(props: CreateBudgetProps): Budget {
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

function requirePeriod(value: string): string {
  if (!periodPattern.test(value))
    throw new DomainError("invalid_date", "Budget period must use the YYYY-MM format.");
  return value;
}
