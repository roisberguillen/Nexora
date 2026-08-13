import { Account, InvestmentPosition, LocalDate, Money } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InvestmentsPage } from "./InvestmentsPage";

const account = Account.create({
  id: "investment-account",
  name: "Broker demo",
  type: "investment",
  currency: "EUR",
});
const position = InvestmentPosition.create({
  id: "position-1",
  accountId: account.id,
  name: "ETF globale",
  symbol: "VWCE",
  costBasis: Money.fromMinor(100_000n, "EUR"),
  currentValue: Money.fromMinor(110_000n, "EUR"),
  valuationDate: LocalDate.parse("2026-08-13"),
});

describe("InvestmentsPage", () => {
  it("does not expose a separate CSV importer", () => {
    render(
      <InvestmentsPage
        accounts={[account]}
        onCreate={async () => undefined}
        onDelete={async () => undefined}
        onUpdate={async () => undefined}
        positions={[]}
      />,
    );
    expect(screen.queryByLabelText(/file csv/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /conferma importazione/i })).toBeNull();
  });

  it("edits a position without losing precise minor-unit values", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);
    render(
      <InvestmentsPage
        accounts={[account]}
        onCreate={async () => undefined}
        onDelete={async () => undefined}
        onUpdate={onUpdate}
        positions={[position]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByRole("heading", { name: "Modifica posizione" })).toBeVisible();
    expect(screen.getByLabelText("Capitale investito")).toHaveValue("1000,00");
    await user.click(screen.getByRole("button", { name: "Aggiorna posizione" }));
    expect(onUpdate).toHaveBeenCalledWith(
      position.id,
      expect.objectContaining({
        costBasisMinor: 100_000n,
        currentValueMinor: 110_000n,
      }),
    );
  });

  it("confirms deletion without offering to delete the investment account", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => undefined);
    render(
      <InvestmentsPage
        accounts={[account]}
        onCreate={async () => undefined}
        onDelete={onDelete}
        onUpdate={async () => undefined}
        positions={[position]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Elimina…" }));
    expect(screen.getByRole("dialog", { name: "Eliminare questa posizione?" })).toHaveTextContent(
      "conto e i movimenti esistenti restano invariati",
    );
    await user.click(screen.getByRole("button", { name: "Elimina posizione" }));
    expect(onDelete).toHaveBeenCalledWith(position.id);
  });
});
