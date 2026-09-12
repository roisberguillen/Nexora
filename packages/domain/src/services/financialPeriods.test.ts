import { describe, expect, it } from "vitest";

import { LocalDate } from "../value-objects/LocalDate";

import {
  financialPeriodBounds,
  financialPeriodContains,
  financialPeriodForDate,
  validateFinancialMonthStartDay,
} from "./financialPeriods";

describe("financial periods", () => {
  it("preserves calendar-month behavior with the default start day", () => {
    expect(financialPeriodForDate(LocalDate.parse("2026-09-01"))).toBe("2026-09");
    expect(financialPeriodForDate(LocalDate.parse("2026-09-30"))).toBe("2026-09");
  });

  it("assigns dates before a custom start day to the previous period", () => {
    expect(financialPeriodForDate(LocalDate.parse("2026-09-14"), 15)).toBe("2026-08");
    expect(financialPeriodForDate(LocalDate.parse("2026-09-15"), 15)).toBe("2026-09");
    expect(financialPeriodForDate(LocalDate.parse("2026-10-14"), 15)).toBe("2026-09");
    expect(financialPeriodForDate(LocalDate.parse("2026-10-15"), 15)).toBe("2026-10");
  });

  it("handles year boundaries and exposes an exclusive end date", () => {
    expect(financialPeriodForDate(LocalDate.parse("2027-01-01"), 15)).toBe("2026-12");
    expect(financialPeriodBounds("2026-12", 15)).toMatchObject({
      startDate: LocalDate.parse("2026-12-15"),
      endDateExclusive: LocalDate.parse("2027-01-15"),
    });
  });

  it("checks membership without changing stored transaction dates", () => {
    expect(financialPeriodContains(LocalDate.parse("2026-02-28"), "2026-02", 15)).toBe(true);
    expect(financialPeriodContains(LocalDate.parse("2026-03-14"), "2026-02", 15)).toBe(true);
    expect(financialPeriodContains(LocalDate.parse("2026-03-15"), "2026-02", 15)).toBe(false);
  });

  it.each([0, 29, 31, 1.5, Number.NaN])("rejects invalid start day %s", (value) => {
    expect(() => validateFinancialMonthStartDay(value)).toThrow("between 1 and 28");
  });
});
