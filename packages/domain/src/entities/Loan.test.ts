import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Loan } from "./Loan";

describe("Loan", () => {
  it("mantiene capitale, rate e progresso nella stessa valuta", () => {
    const loan = Loan.create({
      id: "findomestic",
      accountId: "loan-account",
      lender: "Findomestic",
      installment: Money.fromMinor(17_200n, "EUR"),
      originalPrincipal: Money.fromMinor(1_000_000n, "EUR"),
      remainingPrincipal: Money.fromMinor(750_000n, "EUR"),
      installmentsPaid: 5,
      installmentsRemaining: 15,
      nextDueDate: LocalDate.parse("2026-08-01"),
    });
    expect(loan.progressPercent()).toBe(25);
  });

  it("rifiuta capitale residuo oltre l'originario", () => {
    expect(() =>
      Loan.create({
        id: "invalid-loan",
        accountId: "loan-account",
        lender: "Agos",
        installment: Money.fromMinor(7_200n, "EUR"),
        originalPrincipal: Money.fromMinor(100_000n, "EUR"),
        remainingPrincipal: Money.fromMinor(100_001n, "EUR"),
      }),
    ).toThrow(/Remaining principal/);
  });
});
