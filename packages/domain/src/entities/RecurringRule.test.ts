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

  it("calcola le date italiane richieste dal ciclo C4.5", () => {
    const rule = RecurringRule.create({
      id: "salary-c4-5",
      name: "Stipendio C4.5",
      kind: "income",
      accountId: "main",
      amount: Money.fromMinor(250_000n, "EUR"),
      nominalDay: 28,
      weekendPolicy: "salary_italy",
      nextNominalDate: LocalDate.parse("2026-03-28"),
    });
    expect(rule.nextExpectedDate.toString()).toBe("2026-03-27");
    expect(rule.expectedDateFor(LocalDate.parse("2026-06-01")).toString()).toBe("2026-06-29");
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

describe("advanced recurring calendar", () => {
  const base = {
    id: "advanced-rule",
    name: "Affitto",
    kind: "expense" as const,
    accountId: "account",
    amount: Money.fromMinor(-120_000n, "EUR"),
  };

  it.each([
    ["week", 1, "2026-12-29", "2027-01-05"],
    ["week", 2, "2026-12-29", "2027-01-12"],
  ] as const)(
    "advances %s schedules without approximating months",
    (frequencyUnit, interval, start, expected) => {
      const rule = RecurringRule.create({
        ...base,
        frequencyUnit,
        interval,
        nextNominalDate: LocalDate.parse(start),
      });
      expect(rule.advance().nextNominalDate.toString()).toBe(expected);
    },
  );

  it.each([
    [1, "2027-01-31", "2027-02-28", "2027-03-31"],
    [2, "2027-01-31", "2027-03-31", "2027-05-31"],
    [3, "2027-01-31", "2027-04-30", "2027-07-31"],
    [6, "2027-01-31", "2027-07-31", "2028-01-31"],
  ] as const)("preserves nominal day for month interval %i", (interval, start, second, third) => {
    const rule = RecurringRule.create({
      ...base,
      frequencyUnit: "month",
      interval,
      nominalDay: 31,
      nextNominalDate: LocalDate.parse(start),
    });
    expect(rule.advance().nextNominalDate.toString()).toBe(second);
    expect(rule.advance().advance().nextNominalDate.toString()).toBe(third);
  });

  it("returns to 29 February in a later leap year", () => {
    const rule = RecurringRule.create({
      ...base,
      frequencyUnit: "year",
      nominalMonth: 2,
      nominalDay: 29,
      nextNominalDate: LocalDate.parse("2028-02-29"),
    });
    expect(rule.advance().nextNominalDate.toString()).toBe("2029-02-28");
    expect(rule.advance().advance().advance().advance().nextNominalDate.toString()).toBe(
      "2032-02-29",
    );
  });

  it.each([
    ["previous_business_day", "2026-08-01", "2026-07-31"],
    ["previous_business_day", "2026-08-02", "2026-07-31"],
    ["next_business_day", "2026-08-01", "2026-08-03"],
    ["next_business_day", "2026-08-02", "2026-08-03"],
  ] as const)("applies %s only to the effective date", (weekendPolicy, nominal, effective) => {
    const rule = RecurringRule.create({
      ...base,
      frequencyUnit: "month",
      nominalDay: 1,
      weekendPolicy,
      nextNominalDate: LocalDate.parse(nominal),
    });
    expect(rule.nextExpectedDate.toString()).toBe(effective);
    expect(rule.advance().nextNominalDate.toString()).toBe("2026-09-01");
  });

  it("preserves optional expense behavior and rejects it for income", () => {
    expect(
      RecurringRule.create({
        ...base,
        nextNominalDate: LocalDate.parse("2026-08-01"),
        expenseVariability: "fixed",
        expenseExceptionality: "ordinary",
      }).expenseVariability,
    ).toBe("fixed");
    expect(() =>
      RecurringRule.create({
        ...base,
        kind: "income",
        amount: Money.fromMinor(1n, "EUR"),
        nextNominalDate: LocalDate.parse("2026-08-01"),
        expenseVariability: "fixed",
      }),
    ).toThrow("Expense behavior");
  });
});
