import { DomainError } from "../errors/DomainError";
import { normalizeOptionalText, requireIdentifier } from "../validation";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import type { Transaction, TransactionKind } from "./Transaction";

export type RecurringFrequency = "monthly";
export type WeekendPolicy = "none" | "salary_italy";

export interface CreateRecurringRuleProps {
  readonly id: string;
  readonly name: string;
  readonly kind: "income" | "expense";
  readonly accountId: string;
  readonly amount: Money;
  readonly categoryId?: string;
  readonly payee?: string;
  readonly frequency?: RecurringFrequency;
  readonly interval?: number;
  readonly nominalDay: number;
  readonly weekendPolicy?: WeekendPolicy;
  readonly nextExpectedDate: LocalDate;
  readonly enabled?: boolean;
}

export class RecurringRule {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: Extract<TransactionKind, "income" | "expense">;
  public readonly accountId: string;
  public readonly amount: Money;
  public readonly categoryId: string | undefined;
  public readonly payee: string | undefined;
  public readonly frequency: RecurringFrequency;
  public readonly interval: number;
  public readonly nominalDay: number;
  public readonly weekendPolicy: WeekendPolicy;
  public readonly nextExpectedDate: LocalDate;
  public readonly enabled: boolean;

  private constructor(props: CreateRecurringRuleProps) {
    this.id = requireIdentifier(props.id, "Recurring rule id");
    this.name = requireName(props.name);
    this.kind = props.kind;
    this.accountId = requireIdentifier(props.accountId, "Recurring rule account id");
    this.amount = props.amount;
    this.categoryId =
      props.categoryId === undefined
        ? undefined
        : requireIdentifier(props.categoryId, "Recurring rule category id");
    this.payee = normalizeOptionalText(props.payee, 240);
    this.frequency = props.frequency ?? "monthly";
    this.interval = props.interval ?? 1;
    this.nominalDay = props.nominalDay;
    this.weekendPolicy = props.weekendPolicy ?? "none";
    this.nextExpectedDate = props.nextExpectedDate;
    this.enabled = props.enabled ?? true;
    if (this.kind !== "income" && this.kind !== "expense")
      throw new DomainError("invalid_transaction", "Recurring rules require income or expense.");
    if (this.frequency !== "monthly" || !Number.isInteger(this.interval) || this.interval < 1)
      throw new DomainError("invalid_date", "Recurring frequency or interval is invalid.");
    if (!Number.isInteger(this.nominalDay) || this.nominalDay < 1 || this.nominalDay > 31)
      throw new DomainError("invalid_date", "Recurring nominal day must be between 1 and 31.");
    if (this.weekendPolicy !== "none" && this.weekendPolicy !== "salary_italy")
      throw new DomainError("invalid_date", "Recurring weekend policy is invalid.");
    if (
      (this.kind === "income" && !this.amount.isPositive()) ||
      (this.kind === "expense" && !this.amount.isNegative())
    )
      throw new DomainError("invalid_transaction", "Recurring rule amount has the wrong sign.");
    if (!this.nextExpectedDate.equals(this.expectedDateFor(this.nextExpectedDate)))
      throw new DomainError(
        "invalid_date",
        "Next expected date does not match the recurring rule.",
      );
    Object.freeze(this);
  }

  public static create(props: CreateRecurringRuleProps): RecurringRule {
    return new RecurringRule(props);
  }

  public expectedDateFor(month: LocalDate): LocalDate {
    const [year, calendarMonth] = month.toString().split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const nominal = new Date(
      Date.UTC(
        year,
        calendarMonth - 1,
        Math.min(this.nominalDay, daysInMonth(year, calendarMonth)),
      ),
    );
    if (this.weekendPolicy === "salary_italy") {
      if (nominal.getUTCDay() === 6) nominal.setUTCDate(nominal.getUTCDate() - 1);
      if (nominal.getUTCDay() === 0) nominal.setUTCDate(nominal.getUTCDate() + 1);
    }
    return LocalDate.parse(nominal.toISOString().slice(0, 10));
  }

  public matchesBookedTransaction(transaction: Transaction): boolean {
    return (
      this.enabled &&
      transaction.status === "booked" &&
      transaction.kind === this.kind &&
      transaction.accountId === this.accountId &&
      transaction.amount.equals(this.amount) &&
      transaction.bookedDate.equals(this.nextExpectedDate)
    );
  }
}

function requireName(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 120)
    throw new DomainError("invalid_identifier", "Recurring rule name is invalid.");
  return normalized;
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
