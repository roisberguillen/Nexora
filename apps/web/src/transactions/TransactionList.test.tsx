import { Money } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TransactionList } from "./TransactionList";
import type { TransactionListItem } from "./buildTransactionsViewModel";

describe("TransactionList", () => {
  it("renders banking hierarchy and only operationally useful badges", () => {
    render(<TransactionList {...props()} />);

    expect(screen.getByText("Supermercato")).toBeVisible();
    expect(screen.getAllByTitle("Alimentari · Conto corrente")).toHaveLength(2);
    expect(screen.getAllByText("18 ago 2026")).toHaveLength(2);
    expect(screen.getAllByText((_, element) => element?.textContent === "-42,90 €")).toHaveLength(
      2,
    );
    expect(screen.getByText("Previsto")).toBeVisible();
    expect(screen.queryByText("Contabilizzato")).toBeNull();
  });

  it("keeps actions in an accessible contextual menu and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(<TransactionList {...props()} />);
    const menu = screen.getByRole("button", { name: "Azioni per Supermercato" });

    await user.click(menu);
    expect(screen.getByRole("menuitem", { name: "Modifica" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Annulla" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Sposta nel cestino" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(menu).toHaveFocus();
  });

  it("does not expose edit for imported rows and only renders checkboxes in selection mode", async () => {
    const user = userEvent.setup();
    render(<TransactionList {...props({ selectionMode: false })} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Azioni per Importato" }));
    expect(screen.queryByRole("menuitem", { name: "Modifica" })).toBeNull();
  });

  it("renders transfers as neutral amounts without an income or expense sign", () => {
    render(
      <TransactionList
        {...props({
          items: [
            item({
              amount: Money.fromMinor(185_000n, "EUR"),
              isTransfer: true,
              title: "Giroconto",
            }),
          ],
        })}
      />,
    );

    const amount = screen.getByText((_, element) => element?.textContent === "1.850,00 €");
    expect(amount).toHaveClass("is-neutral");
    expect(amount).not.toHaveTextContent("+");
  });

  it("opens details only from the row's explicit main control", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<TransactionList {...props({ onOpen })} />);

    const rowControl = screen.getByText("Supermercato").closest("button");
    expect(rowControl).not.toBeNull();
    await user.click(rowControl!);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "expense" }),
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: "Azioni per Supermercato" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

function props(overrides: Partial<React.ComponentProps<typeof TransactionList>> = {}) {
  return {
    isSaving: false,
    items: [item(), item({ id: "imported", title: "Importato", source: "import" })],
    onCancel: vi.fn(),
    onEdit: vi.fn(),
    onTrash: vi.fn(),
    onToggleSelection: vi.fn(),
    selectedIds: new Set<string>(),
    selectionMode: true,
    ...overrides,
  };
}

function item(overrides: Partial<TransactionListItem> = {}): TransactionListItem {
  return {
    accountLabel: "Conto corrente",
    amount: Money.fromMinor(-4_290n, "EUR"),
    bookedDate: "2026-08-18",
    canCancel: true,
    categoryLabel: "Alimentari",
    id: "expense",
    isTransfer: false,
    kind: "expense",
    kindLabel: "Spesa",
    source: "manual",
    status: "expected",
    statusLabel: "Previsto",
    title: "Supermercato",
    ...overrides,
  };
}
