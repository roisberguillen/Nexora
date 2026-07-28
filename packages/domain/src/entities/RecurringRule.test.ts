import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { RecurringRule } from "./RecurringRule";
import { Transaction } from "./Transaction";

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

  it("riconosce soltanto la registrazione contabilizzata attesa", () => {
    const rule = RecurringRule.create({
      id: "salary",
      name: "Stipendio",
      kind: "income",
      accountId: "main",
      amount: Money.fromMinor(250_000n, "EUR"),
      nominalDay: 28,
      weekendPolicy: "salary_italy",
      nextExpectedDate: LocalDate.parse("2026-07-28"),
    });
    const matching = Transaction.create({
      id: "income",
      kind: "income",
      status: "booked",
      accountId: "main",
      amount: Money.fromMinor(250_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-28"),
    });
    const expected = Transaction.create({
      id: "expected",
      kind: "income",
      status: "expected",
      accountId: "main",
      amount: Money.fromMinor(250_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-28"),
    });
    expect(rule.matchesBookedTransaction(matching)).toBe(true);
    expect(rule.matchesBookedTransaction(expected)).toBe(false);
  });
});
