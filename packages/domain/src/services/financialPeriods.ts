import { DomainError } from "../errors/DomainError";
import { LocalDate } from "../value-objects/LocalDate";

export const DEFAULT_FINANCIAL_MONTH_START_DAY = 1;
export const MIN_FINANCIAL_MONTH_START_DAY = 1;
export const MAX_FINANCIAL_MONTH_START_DAY = 28;

export interface FinancialPeriodBounds {
  readonly key: string;
  readonly startDate: LocalDate;
  /** Exclusive boundary: the first date belonging to the next period. */
  readonly endDateExclusive: LocalDate;
}

/** Validates the conservative day range that is valid in every Gregorian month. */
export function validateFinancialMonthStartDay(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < MIN_FINANCIAL_MONTH_START_DAY ||
    value > MAX_FINANCIAL_MONTH_START_DAY
  ) {
    throw new DomainError(
      "invalid_date",
      `Financial month start day must be between ${MIN_FINANCIAL_MONTH_START_DAY} and ${MAX_FINANCIAL_MONTH_START_DAY}.`,
    );
  }
  return value;
}

/** Returns the YYYY-MM key of the financial period containing a civil date. */
export function financialPeriodForDate(
  date: LocalDate,
  startDay = DEFAULT_FINANCIAL_MONTH_START_DAY,
): string {
  const day = validateFinancialMonthStartDay(startDay);
  const [year, month, civilDay] = partsOf(date);
  if (civilDay >= day) return monthKey(year, month);
  return monthKey(...previousMonth(year, month));
}

/** Resolves the inclusive start and exclusive end of a YYYY-MM financial period. */
export function financialPeriodBounds(
  period: string,
  startDay = DEFAULT_FINANCIAL_MONTH_START_DAY,
): FinancialPeriodBounds {
  const day = validateFinancialMonthStartDay(startDay);
  const [year, month] = partsOfPeriod(period);
  const [nextYear, nextMonthValue] = nextCalendarMonth(year, month);
  return Object.freeze({
    key: period,
    startDate: LocalDate.parse(dateKey(year, month, day)),
    endDateExclusive: LocalDate.parse(dateKey(nextYear, nextMonthValue, day)),
  });
}

export function financialPeriodContains(
  date: LocalDate,
  period: string,
  startDay = DEFAULT_FINANCIAL_MONTH_START_DAY,
): boolean {
  const bounds = financialPeriodBounds(period, startDay);
  return (
    date.toString() >= bounds.startDate.toString() &&
    date.toString() < bounds.endDateExclusive.toString()
  );
}

function partsOf(date: LocalDate): [number, number, number] {
  const [year, month, day] = date.toString().split("-").map(Number);
  return [year!, month!, day!];
}

function partsOfPeriod(period: string): [number, number] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new DomainError("invalid_date", "Financial period must use the YYYY-MM format.");
  }
  return [Number(period.slice(0, 4)), Number(period.slice(5, 7))];
}

function monthKey(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function dateKey(year: number, month: number, day: number): string {
  return `${monthKey(year, month)}-${String(day).padStart(2, "0")}`;
}

function previousMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

function nextCalendarMonth(year: number, month: number): [number, number] {
  return month === 12 ? [year + 1, 1] : [year, month + 1];
}
