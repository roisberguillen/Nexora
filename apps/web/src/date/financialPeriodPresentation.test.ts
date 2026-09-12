import { describe, expect, it } from "vitest";

import { formatFinancialPeriod } from "./financialPeriodPresentation";

describe("formatFinancialPeriod", () => {
  it("keeps the compact label for calendar months", () => {
    expect(formatFinancialPeriod("2026-09")).toBe("Settembre 2026");
  });

  it("shows both civil boundaries for a custom financial month", () => {
    expect(formatFinancialPeriod("2026-09", 15)).toBe("15 settembre 2026 – 14 ottobre 2026");
  });
});
