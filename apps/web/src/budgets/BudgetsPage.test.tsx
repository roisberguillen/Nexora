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
  firstAlertPercentage: 60,
  secondAlertPercentage: 90,
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
  it("requires the two user-selected notification thresholds", () => {
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

    expect(screen.getByLabelText("Prima soglia di notifica (%)")).toHaveValue(null);
    expect(screen.getByLabelText("Seconda soglia di notifica (%)")).toHaveValue(null);
    expect(screen.queryByLabelText("Periodo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crea budget" })).toBeVisible();
  });

  it("requires a subcategory and ordered thresholds before saving", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);
    render(
      <BudgetsPage
        budgets={[]}
        categories={categories}
        onCreate={onCreate}
        onDelete={async () => undefined}
        onUpdate={async () => undefined}
        transactions={[]}
        transactionSplits={[]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Categoria"), "transport");
    await user.selectOptions(screen.getByLabelText("Sotto-categoria"), "fuel");
    await user.type(screen.getByLabelText("Importo"), "80,00");
    await user.type(screen.getByLabelText("Prima soglia di notifica (%)"), "90");
    await user.type(screen.getByLabelText("Seconda soglia di notifica (%)"), "50");
    await user.click(screen.getByRole("button", { name: "Salva budget" }));

    expect(screen.getByRole("alert")).toHaveTextContent("prima minore della seconda");
    expect(onCreate).not.toHaveBeenCalled();
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
    expect(screen.getByRole("option", { name: "Carburante" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Sotto-categoria"), "fuel");
    await user.click(screen.getByRole("button", { name: "Aggiorna budget" }));
    expect(onUpdate).toHaveBeenCalledWith(
      "transport-february",
      expect.objectContaining({
        categoryId: "fuel",
        firstAlertPercentage: 60,
        secondAlertPercentage: 90,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "I movimenti associati non verranno cancellati.",
    );
    await user.click(screen.getByRole("button", { name: "Elimina budget" }));
    expect(onDelete).toHaveBeenCalledWith("transport-february");
  });
});
