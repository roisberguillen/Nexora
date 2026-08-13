import { LocalDate, Money, Transaction } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalyticsPage } from "./AnalyticsPage";

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
        transactions={[
          row("income", "income", 100_000n, "2026-07-01"),
          row("expense", "expense", -40_000n, "2026-07-02"),
          row("income-2", "income", 120_000n, "2026-08-01"),
          row("expense-2", "expense", -50_000n, "2026-08-02"),
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Ultimo mese rispetto al precedente" }),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: "Grafico delle spese mensili" })).toBeVisible();
    expect(screen.getAllByText("2026-08")).toHaveLength(2);
  });
  it("shows empty-state fallback", () => {
    render(<AnalyticsPage transactions={[]} />);
    expect(screen.getByText("Dati insufficienti")).toBeVisible();
  });
});
