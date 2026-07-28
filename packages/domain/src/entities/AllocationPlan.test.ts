import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/Money";
import { AllocationPlan } from "./AllocationPlan";
describe("AllocationPlan", () => {
  it("protegge destinazione distinta e importo positivo", () => {
    expect(() =>
      AllocationPlan.create({
        id: "allocation",
        name: "Risparmio",
        trigger: "salary",
        sourceAccountId: "main",
        targetAccountId: "main",
        amount: Money.fromMinor(17_000n, "EUR"),
      }),
    ).toThrow(/distinct/i);
    expect(() =>
      AllocationPlan.create({
        id: "allocation",
        name: "Risparmio",
        trigger: "salary",
        sourceAccountId: "main",
        targetAccountId: "saving",
        amount: Money.fromMinor(-17_000n, "EUR"),
      }),
    ).toThrow(/positive/i);
  });
});
