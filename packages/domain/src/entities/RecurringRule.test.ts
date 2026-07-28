import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { RecurringRule } from "./RecurringRule";

describe("RecurringRule", () => {
  it("applica la policy dello stipendio per sabato e domenica", () => {
    const rule = RecurringRule.create({
      id: "salary",
      name: "Stipendio",
      kind: "income",
      accountId: "main",
      amount: Money.fromMinor(250_000n, "EUR"),
      nominalDay: 28,
      weekendPolicy: "salary_italy",
      nextExpectedDate: LocalDate.parse("2025-09-29"),
    });
    expect(rule.expectedDateFor(LocalDate.parse("2026-02-01")).toString()).toBe("2026-02-27");
    expect(rule.expectedDateFor(LocalDate.parse("2025-09-01")).toString()).toBe("2025-09-29");
  });
});
