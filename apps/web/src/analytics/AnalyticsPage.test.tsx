import { LocalDate, Money, Transaction, type Category } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalyticsPage } from "./AnalyticsPage";

const categories: readonly Category[] = [];

const row = (id: string, kind: "income" | "expense", amount: bigint, date: string) =>
  Transaction.create({
    id,
    kind,
    status: "booked",
    accountId: "account",
    amount: Money.fromMinor(amount, "EUR"),
    bookedDate: LocalDate.parse(date),
  });
describe("AnalyticsPage", () => {
  it("renders trend, forecast, comparison and accessible chart from booked ledger data", () => {
    render(
      <AnalyticsPage
        categories={categories}
        transactions={[
          row("income", "income", 100_000n, "2026-07-01"),
          row("expense", "expense", -40_000n, "2026-07-02"),
          row("income-2", "income", 120_000n, "2026-08-01"),
          row("expense-2", "expense", -50_000n, "2026-08-02"),
        ]}
        transactionSplits={[]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Rispetto a luglio 2026" })).toBeVisible();
    expect(screen.getAllByText("Entrate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Spese").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Risparmio").length).toBeGreaterThan(0);
    expect(screen.getByText("Media spese ultimi 6 mesi")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Andamento mensile di entrate, spese e risparmio" }),
    ).toBeVisible();
    expect(screen.getAllByText("2026-08")).toHaveLength(2);
    expect(
      screen
        .getByRole("img", { name: "Andamento mensile di entrate, spese e risparmio" })
        .closest(".analytics-panel-content"),
    ).not.toBeNull();
  });
  it("shows empty-state fallback", () => {
    render(<AnalyticsPage categories={[]} transactions={[]} transactionSplits={[]} />);
    expect(screen.getByText("Non ci sono movimenti in questo mese.")).toBeVisible();
  });
});
