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
