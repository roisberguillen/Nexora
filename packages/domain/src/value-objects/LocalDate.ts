import { DomainError } from "../errors/DomainError";

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

export class LocalDate {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  public static parse(value: string): LocalDate {
    const match = localDatePattern.exec(value);
    if (!match) {
      throw new DomainError("invalid_date", "LocalDate must use the YYYY-MM-DD format.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
      !Number.isInteger(year) ||
      year < 1 ||
      year > 9999 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(year, month)
    ) {
      throw new DomainError("invalid_date", "LocalDate must be a valid calendar date.");
    }

    return new LocalDate(value);
  }

  public equals(other: LocalDate): boolean {
    return this.value === other.value;
  }

  public toJSON(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }
}
