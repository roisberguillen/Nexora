import { render, screen } from "@testing-library/react";
import { Account, InvestmentPosition, Loan, LocalDate, Money } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { Dashboard } from "./Dashboard";
import { buildDashboardViewModel } from "./buildDashboardViewModel";
import { barSize } from "./trendBar";

describe("Dashboard trend bars", () => {
  it.each([
    [0n, 100n, 0],
    [100n, 0n, 100],
    [0n, 0n, 0],
    [50n, 100n, 50],
  ])("uses no quantitative height for zero values", (current, previous, expected) => {
    expect(barSize(current, previous)).toBe(expected);
  });
});

describe("Dashboard separate debt and investment summary", () => {
  it("renders compatible loan and investment values outside primary KPIs", () => {
    const account = Account.create({
      id: "cash",
      name: "Conto",
      type: "checking",
      currency: "EUR",
    });
    const investmentAccount = Account.create({
      id: "investment",
      name: "Conto investimenti",
      type: "investment",
      currency: "EUR",
    });
    const model = buildDashboardViewModel(
      {
        accounts: [account, investmentAccount],
        categories: [],
        transactions: [],
        transfers: [],
        loans: [
          Loan.create({
            id: "loan",
            accountId: "loan-account",
            lender: "Finanziaria test",
            installment: Money.fromMinor(17_200n, "EUR"),
            remainingPrincipal: Money.fromMinor(482_800n, "EUR"),
          }),
        ],
        investmentPositions: [
          InvestmentPosition.create({
            id: "position",
            accountId: investmentAccount.id,
            name: "ETF Nasdaq",
            costBasis: Money.fromMinor(106_000n, "EUR"),
            currentValue: Money.fromMinor(120_000n, "EUR"),
            valuationDate: LocalDate.parse("2026-09-05"),
          }),
        ],
      },
      "EUR",
      new Date("2026-09-05T10:00:00+02:00"),
    );
    render(
      <Dashboard
        hasSeedFeedback={false}
        isSeeding={false}
        model={model}
        onAddDemoData={() => undefined}
      />,
    );
    expect(screen.getByRole("region", { name: "Debiti e investimenti" })).toHaveTextContent(
      "Debiti e investimenti",
    );
    expect(screen.getByText("Capitale residuo prestiti")).toBeVisible();
    expect(screen.getByText("4.828,00 €")).toBeVisible();
    const separateSummary = screen.getByRole("region", { name: "Debiti e investimenti" });
    expect(separateSummary).toHaveTextContent("+140,00");
    expect(separateSummary).toHaveTextContent("13,20%");
    expect(screen.getByRole("link", { name: "Vedi prestiti" })).toHaveAttribute("href", "#loans");
    expect(screen.getByRole("link", { name: "Vedi investimenti" })).toHaveAttribute(
      "href",
      "#investments",
    );
  });
});
