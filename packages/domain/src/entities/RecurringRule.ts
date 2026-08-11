import { DomainError } from "../errors/DomainError";
import { normalizeOptionalText, requireIdentifier } from "../validation";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import type {
  ExpenseExceptionality,
  ExpenseVariability,
  Transaction,
  TransactionKind,
} from "./Transaction";

/** A single unit plus interval is the source of truth for a schedule. */
export type RecurrenceUnit = "week" | "month" | "year";
/** Retained only so persisted v5 monthly rules remain source-compatible on read. */
export type RecurringFrequency = "monthly";
export type WeekendPolicy = "none" | "previous_business_day" | "next_business_day" | "salary_italy";

export interface CreateRecurringRuleProps {
  readonly id: string;
  readonly name: string;
  readonly kind: "income" | "expense";
  readonly accountId: string;
  readonly amount: Money;
  readonly categoryId?: string;
  readonly payee?: string;
  /** Legacy v5 representation. New callers use frequencyUnit. */
  readonly frequency?: RecurringFrequency;
  readonly frequencyUnit?: RecurrenceUnit;
  readonly interval?: number;
  /** Required for month/year schedules and absent for weekly schedules. */
  readonly nominalDay?: number;
  /** Explicit annual anchor month; defaults to the month in nextNominalDate. */
  readonly nominalMonth?: number;
  readonly weekendPolicy?: WeekendPolicy;
  /** Canonical unadjusted calendar cursor. */
  readonly nextNominalDate?: LocalDate;
  /** Derived effective date; accepted to read legacy records and validated when supplied. */
  readonly nextExpectedDate?: LocalDate;
  readonly enabled?: boolean;
  readonly retiredAt?: string;
  readonly expenseVariability?: ExpenseVariability;
  readonly expenseExceptionality?: ExpenseExceptionality;
}

export class RecurringRule {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: Extract<TransactionKind, "income" | "expense">;
  public readonly accountId: string;
  public readonly amount: Money;
  public readonly categoryId: string | undefined;
  public readonly payee: string | undefined;
  /** Legacy-compatible label. Never use this to infer the interval. */
  public readonly frequency: RecurringFrequency;
  public readonly frequencyUnit: RecurrenceUnit;
  public readonly interval: number;
  /** Weekly rules retain their anchor weekday's calendar day for legacy UI compatibility. */
  public readonly nominalDay: number;
  public readonly nominalMonth: number | undefined;
  public readonly weekendPolicy: WeekendPolicy;
  public readonly nextNominalDate: LocalDate;
  public readonly nextExpectedDate: LocalDate;
  public readonly enabled: boolean;
  public readonly retiredAt: string | undefined;
  public readonly expenseVariability: ExpenseVariability | undefined;
  public readonly expenseExceptionality: ExpenseExceptionality | undefined;

  private constructor(props: CreateRecurringRuleProps) {
    this.id = requireIdentifier(props.id, "Recurring rule id");
    this.name = requireName(props.name);
    this.kind = props.kind;
    this.accountId = requireIdentifier(props.accountId, "Recurring rule account id");
    this.amount = props.amount;
    this.categoryId = optionalId(props.categoryId, "Recurring rule category id");
    this.payee = normalizeOptionalText(props.payee, 240);
    this.frequency = "monthly";
    this.frequencyUnit = props.frequencyUnit ?? "month";
    this.interval = props.interval ?? 1;
    this.weekendPolicy = props.weekendPolicy ?? "none";
    this.enabled = props.enabled ?? true;
    this.retiredAt = normalizeOptionalText(props.retiredAt, 64);
    this.expenseVariability = props.expenseVariability;
    this.expenseExceptionality = props.expenseExceptionality;

    if (this.kind !== "income" && this.kind !== "expense")
      throw new DomainError("invalid_transaction", "Recurring rules require income or expense.");
    if (!["week", "month", "year"].includes(this.frequencyUnit))
      throw new DomainError("invalid_date", "Recurring frequency unit is invalid.");
    if (!Number.isInteger(this.interval) || this.interval < 1 || this.interval > 120)
      throw new DomainError("invalid_date", "Recurring interval is invalid.");
    if (!isWeekendPolicy(this.weekendPolicy))
      throw new DomainError("invalid_date", "Recurring weekend policy is invalid.");
    if (
      (this.kind === "income" && !this.amount.isPositive()) ||
      (this.kind === "expense" && !this.amount.isNegative())
    )
      throw new DomainError("invalid_transaction", "Recurring rule amount has the wrong sign.");
    this.assertExpenseBehavior();

    const cursor = props.nextNominalDate ?? this.deriveLegacyNominalDate(props);
    this.nominalDay = props.nominalDay ?? dayOf(cursor);
    this.nominalMonth =
      this.frequencyUnit === "year" ? (props.nominalMonth ?? monthOf(cursor)) : undefined;
    this.assertNominalAnchor();
    this.nextNominalDate = this.normalizeNominalDate(cursor);
    this.nextExpectedDate = this.effectiveDateFor(this.nextNominalDate);
    if (
      props.nextExpectedDate !== undefined &&
      !props.nextExpectedDate.equals(this.nextExpectedDate)
    )
      throw new DomainError(
        "invalid_date",
        "Next expected date does not match the recurring rule.",
      );
    Object.freeze(this);
  }

  public static create(props: CreateRecurringRuleProps): RecurringRule {
    return new RecurringRule(props);
  }

  /** Applies the policy to a nominal civil date without moving the schedule cursor. */
  public effectiveDateFor(nominalDate: LocalDate): LocalDate {
    const weekday = weekdayOf(nominalDate);
    if (this.weekendPolicy === "none" || (weekday !== 0 && weekday !== 6)) return nominalDate;
    if (this.weekendPolicy === "previous_business_day")
      return addDays(nominalDate, weekday === 6 ? -1 : -2);
    if (this.weekendPolicy === "next_business_day")
      return addDays(nominalDate, weekday === 6 ? 2 : 1);
    // Historical salary policy: Saturday is paid Friday, Sunday on Monday.
    return addDays(nominalDate, weekday === 6 ? -1 : 1);
  }

  /** Compatibility projection for legacy monthly callers. */
  public expectedDateFor(reference: LocalDate): LocalDate {
    return this.effectiveDateFor(this.normalizeNominalDate(reference));
  }

  /** Legacy notification heuristic only; occurrence records are the write-side authority. */
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

  /** Returns an immutable future rule state; it never changes recorded transactions. */
  public advance(): RecurringRule {
    const nextNominalDate = this.advanceNominalDate(this.nextNominalDate);
    return RecurringRule.create({ ...this.toProps(), nextNominalDate });
  }

  public preview(count = 3): readonly { nominalDate: LocalDate; effectiveDate: LocalDate }[] {
    if (!Number.isInteger(count) || count < 1 || count > 24)
      throw new DomainError("invalid_date", "Recurring preview count is invalid.");
    const result: { nominalDate: LocalDate; effectiveDate: LocalDate }[] = [];
    let nominalDate = this.nextNominalDate;
    for (let index = 0; index < count; index += 1) {
      result.push({ nominalDate, effectiveDate: this.effectiveDateFor(nominalDate) });
      nominalDate = this.advanceNominalDate(nominalDate);
    }
    return result;
  }

  public retire(retiredAt: string): RecurringRule {
    return RecurringRule.create({ ...this.toProps(), enabled: false, retiredAt });
  }

  public toProps(): CreateRecurringRuleProps {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      accountId: this.accountId,
      amount: this.amount,
      frequencyUnit: this.frequencyUnit,
      interval: this.interval,
      weekendPolicy: this.weekendPolicy,
      nextNominalDate: this.nextNominalDate,
      enabled: this.enabled,
      nominalDay: this.nominalDay,
      ...(this.nominalMonth === undefined ? {} : { nominalMonth: this.nominalMonth }),
      ...(this.categoryId === undefined ? {} : { categoryId: this.categoryId }),
      ...(this.payee === undefined ? {} : { payee: this.payee }),
      ...(this.retiredAt === undefined ? {} : { retiredAt: this.retiredAt }),
      ...(this.expenseVariability === undefined
        ? {}
        : { expenseVariability: this.expenseVariability }),
      ...(this.expenseExceptionality === undefined
        ? {}
        : { expenseExceptionality: this.expenseExceptionality }),
    };
  }

  private deriveLegacyNominalDate(props: CreateRecurringRuleProps): LocalDate {
    if (props.nextExpectedDate === undefined)
      throw new DomainError("invalid_date", "Recurring rules require a next nominal date.");
    const nominalDay = props.nominalDay;
    if (nominalDay === undefined) return props.nextExpectedDate;
    const [year, month] = partsOf(props.nextExpectedDate);
    return dateOf(year, month, Math.min(nominalDay, daysInMonth(year, month)));
  }

  private normalizeNominalDate(date: LocalDate): LocalDate {
    if (this.frequencyUnit === "week") return date;
    const [year, month] = partsOf(date);
    const targetMonth = this.frequencyUnit === "year" ? this.nominalMonth! : month;
    return dateOf(year, targetMonth, Math.min(this.nominalDay!, daysInMonth(year, targetMonth)));
  }

  private advanceNominalDate(date: LocalDate): LocalDate {
    const [year, month] = partsOf(date);
    if (this.frequencyUnit === "week") return addDays(date, this.interval * 7);
    if (this.frequencyUnit === "month") {
      const total = year * 12 + month - 1 + this.interval;
      const targetYear = Math.floor(total / 12);
      const targetMonth = (total % 12) + 1;
      return dateOf(
        targetYear,
        targetMonth,
        Math.min(this.nominalDay!, daysInMonth(targetYear, targetMonth)),
      );
    }
    const targetYear = year + this.interval;
    return dateOf(
      targetYear,
      this.nominalMonth!,
      Math.min(this.nominalDay!, daysInMonth(targetYear, this.nominalMonth!)),
    );
  }

  private assertNominalAnchor(): void {
    if (!Number.isInteger(this.nominalDay) || this.nominalDay < 1 || this.nominalDay > 31)
      throw new DomainError("invalid_date", "Recurring nominal day must be between 1 and 31.");
    if (
      this.frequencyUnit === "year" &&
      (!Number.isInteger(this.nominalMonth) || this.nominalMonth! < 1 || this.nominalMonth! > 12)
    )
      throw new DomainError("invalid_date", "Recurring nominal month must be between 1 and 12.");
  }

  private assertExpenseBehavior(): void {
    if (this.kind !== "expense") {
      if (this.expenseVariability !== undefined || this.expenseExceptionality !== undefined)
        throw new DomainError(
          "invalid_transaction",
          "Expense behavior requires an expense recurring rule.",
        );
      return;
    }
    if (
      this.expenseVariability !== undefined &&
      this.expenseVariability !== "fixed" &&
      this.expenseVariability !== "variable"
    )
      throw new DomainError("invalid_transaction", "Expense variability is invalid.");
    if (
      this.expenseExceptionality !== undefined &&
      this.expenseExceptionality !== "ordinary" &&
      this.expenseExceptionality !== "extraordinary"
    )
      throw new DomainError("invalid_transaction", "Expense exceptionality is invalid.");
  }
}

function requireName(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 120)
    throw new DomainError("invalid_identifier", "Recurring rule name is invalid.");
  return normalized;
}
function optionalId(value: string | undefined, label: string): string | undefined {
  return value === undefined ? undefined : requireIdentifier(value, label);
}
function isWeekendPolicy(value: string): value is WeekendPolicy {
  return ["none", "previous_business_day", "next_business_day", "salary_italy"].includes(value);
}
function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}
function partsOf(date: LocalDate): [number, number, number] {
  return date.toString().split("-").map(Number) as [number, number, number];
}
function dayOf(date: LocalDate): number {
  return partsOf(date)[2];
}
function monthOf(date: LocalDate): number {
  return partsOf(date)[1];
}
function dateOf(year: number, month: number, day: number): LocalDate {
  return LocalDate.parse(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );
}
function addDays(date: LocalDate, offset: number): LocalDate {
  let [year, month, day] = partsOf(date);
  day += offset;
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  while (day < 1) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    day += daysInMonth(year, month);
  }
  return dateOf(year, month, day);
}
/** Gregorian weekday, 0 Sunday through 6 Saturday, without platform Date/UTC conversion. */
function weekdayOf(date: LocalDate): number {
  const [initialYear, initialMonth, day] = partsOf(date);
  let year = initialYear;
  let month = initialMonth;
  if (month < 3) {
    year -= 1;
    month += 12;
  }
  return (
    (day +
      Math.floor((13 * (month + 1)) / 5) +
      year +
      Math.floor(year / 4) -
      Math.floor(year / 100) +
      Math.floor(year / 400) +
      6) %
    7
  );
}
