import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NotificationsPage } from "./NotificationsPage";

describe("NotificationsPage", () => {
  it("marks an alert read before opening its deep link", async () => {
    const user = userEvent.setup();
    render(
      <NotificationsPage
        accounts={[]}
        budgets={[]}
        categories={[]}
        loans={[]}
        recurringRules={[]}
        transactionSplits={[]}
        transactions={[]}
      />,
    );

    await user.click(screen.getAllByRole("link", { name: "Apri" }).at(0)!);
    expect(JSON.parse(localStorage.getItem("nexora.local-notifications.v1") ?? "{}")).toEqual(
      expect.objectContaining({
        "backup_overdue:2026-09": expect.objectContaining({ readAt: expect.any(String) }),
      }),
    );
  });

  it("persists dismissed local alerts separately from the ledger and renders the empty state", async () => {
    const user = userEvent.setup();
    render(
      <NotificationsPage
        accounts={[]}
        budgets={[]}
        categories={[]}
        loans={[]}
        recurringRules={[]}
        transactionSplits={[]}
        transactions={[]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Preferenze avvisi" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ignora notifica: Backup da verificare" }));
    await user.click(
      screen.getByRole("button", { name: "Ignora notifica: Recovery drill da eseguire" }),
    );
    expect(screen.getByRole("heading", { name: "Nessuna notifica" })).toBeVisible();
  });
});
