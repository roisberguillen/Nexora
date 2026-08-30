import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Account } from "./Account";
import { InvestmentPosition, assertInvestmentPositionAccount } from "./InvestmentPosition";
describe("InvestmentPosition", () => {
  it("calcola rendimento senza perdere minor units", () => {
    const position = InvestmentPosition.create({
      id: "directa-etf",
      accountId: "directa",
      name: "ETF globale",
      costBasis: Money.fromMinor(100_000n, "EUR"),
      currentValue: Money.fromMinor(112_500n, "EUR"),
      valuationDate: LocalDate.parse("2026-08-01"),
    });
    expect(position.gainLoss().amountMinor).toBe(12_500n);
    expect(position.gainLossPercent()).toBe(12.5);
  });

  it.each([
    { currentValue: 90_000n, gainLoss: -10_000n, percent: -10 },
    { currentValue: 100_000n, gainLoss: 0n, percent: 0 },
    { currentValue: 250_000n, gainLoss: 150_000n, percent: 150 },
  ])(
    "mantiene segno e rendimento per valore corrente $currentValue",
    ({ currentValue, gainLoss, percent }) => {
      const position = InvestmentPosition.create({
        id: `position-${currentValue}`,
        accountId: "directa",
        name: "ETF globale",
        costBasis: Money.fromMinor(100_000n, "EUR"),
        currentValue: Money.fromMinor(currentValue, "EUR"),
        valuationDate: LocalDate.parse("2026-08-01"),
      });
      expect(position.gainLoss().amountMinor).toBe(gainLoss);
      expect(position.gainLossPercent()).toBe(percent);
    },
  );

  it("non produce una percentuale non finita con capitale zero", () => {
    const position = InvestmentPosition.create({
      id: "zero-cost",
      accountId: "directa",
      name: "Posizione gratuita",
      costBasis: Money.fromMinor(0n, "EUR"),
      currentValue: Money.fromMinor(10_000n, "EUR"),
      valuationDate: LocalDate.parse("2026-08-01"),
    });
    expect(position.gainLossPercent()).toBeUndefined();
  });
});

describe("investment position account invariant", () => {
  const position = InvestmentPosition.create({
    id: "position",
    accountId: "account",
    name: "ETF",
    costBasis: Money.fromMinor(1n, "EUR"),
    currentValue: Money.fromMinor(1n, "EUR"),
    valuationDate: LocalDate.parse("2026-08-13"),
  });
  it("requires an active investment account in the same currency", () => {
    expect(() => assertInvestmentPositionAccount(position, undefined)).toThrow("active investment");
    expect(() =>
      assertInvestmentPositionAccount(
        position,
        Account.create({ id: "account", name: "Cash", type: "checking", currency: "EUR" }),
      ),
    ).toThrow("active investment");
    expect(() =>
      assertInvestmentPositionAccount(
        position,
        Account.create({
          id: "account",
          name: "Archived",
          type: "investment",
          currency: "EUR",
          isArchived: true,
        }),
      ),
    ).toThrow("active investment");
    expect(() =>
      assertInvestmentPositionAccount(
        position,
        Account.create({ id: "account", name: "USD", type: "investment", currency: "USD" }),
      ),
    ).toThrow("currency");
  });
});
