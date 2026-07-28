import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { InvestmentPosition } from "./InvestmentPosition";
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
