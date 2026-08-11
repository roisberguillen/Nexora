import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Budget, Category, LocalDate, Money, Transaction } from "@nexora/domain";
import { describe, expect, it, vi } from "vitest";

import { BudgetsPage } from "./BudgetsPage";

const categories = [
  Category.create({ id: "transport", name: "Trasporti", kindScope: "expense" }),
  Category.create({ id: "fuel", name: "Carburante", kindScope: "expense", parentId: "transport" }),
];
const budget = Budget.create({
  id: "transport-february",
  period: "2026-02",
  categoryId: "transport",
  amount: Money.fromMinor(50_000n, "EUR"),
});
const transaction = Transaction.create({
  id: "fuel-expense",
  kind: "expense",
  status: "booked",
  accountId: "main",
  amount: Money.fromMinor(-18_000n, "EUR"),
  bookedDate: LocalDate.parse("2026-02-12"),
  categoryId: "fuel",
});

describe("BudgetsPage", () => {
  it("groups budget alert checkboxes with their labels", () => {
    render(
      <BudgetsPage
        budgets={[]}
        categories={[]}
        onCreate={async () => undefined}
        onDelete={async () => undefined}
        onUpdate={async () => undefined}
        transactions={[]}
        transactionSplits={[]}
      />,
    );

    expect(screen.getByLabelText("Avvisa all’80%").parentElement).toHaveClass(
      "budget-alert-toggle",
    );
    expect(screen.getByLabelText("Avvisa al 100%").parentElement).toHaveClass(
      "budget-alert-toggle",
    );
    expect(screen.getByRole("button", { name: "Crea budget" })).toBeVisible();
  });

  it("renders macro progress and supports edit plus confirmed delete", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => undefined);
    const onUpdate = vi.fn(async () => undefined);
    render(
      <BudgetsPage
        budgets={[budget]}
        categories={categories}
        onCreate={async () => undefined}
        onDelete={onDelete}
        onUpdate={onUpdate}
        transactions={[transaction]}
        transactionSplits={[]}
      />,
    );

    expect(screen.getAllByText("Trasporti")).not.toHaveLength(0);
    expect(screen.getByText("Include 1 sottocategorie")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Consumo budget Trasporti/i })).toHaveAttribute(
      "aria-valuenow",
      "36",
    );
    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByRole("heading", { name: "Modifica budget" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Trasporti → Carburante" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aggiorna budget" }));
    expect(onUpdate).toHaveBeenCalledWith(
      "transport-february",
      expect.objectContaining({ categoryId: "transport", period: "2026-02" }),
    );
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "I movimenti associati non verranno cancellati.",
    );
    await user.click(screen.getByRole("button", { name: "Elimina budget" }));
    expect(onDelete).toHaveBeenCalledWith("transport-february");
  });
});
