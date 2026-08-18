import { Account, LocalDate, Money, Transaction } from "@nexora/domain";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { TransactionsPage } from "./TransactionsPage";
import { buildTransactionsViewModel } from "./buildTransactionsViewModel";

describe("TransactionsPage", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("renders the banking hierarchy, KPI and the existing new-transaction route", async () => {
    const user = userEvent.setup();
    render(<TransactionsPage {...pageProps()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Movimenti" })).toBeVisible();
    expect(screen.queryByText("Ledger locale")).toBeNull();
    const summary = screen.getByRole("region", { name: "Riepilogo movimenti" });
    expect(within(summary).getByText("Entrate").closest("article")).toHaveTextContent("1.200");
    expect(within(summary).getByText("Uscite").closest("article")).toHaveTextContent("300");
    expect(within(summary).getByText("Saldo netto").closest("article")).toHaveTextContent("900");

    await user.click(screen.getByRole("button", { name: /nuovo movimento/i }));
    expect(window.location.hash).toBe("#new-transaction");
  });

  it("updates the KPI for the selected month", () => {
    render(<TransactionsPage {...pageProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Filtri" }));
    fireEvent.change(screen.getByLabelText("Periodo"), { target: { value: "2026-08" } });

    const summary = screen.getByRole("region", { name: "Riepilogo movimenti" });
    expect(within(summary).getByText("Entrate").closest("article")).toHaveTextContent("0,00");
    expect(within(summary).getByText("Uscite").closest("article")).toHaveTextContent("300");
    expect(within(summary).getByText("Saldo netto").closest("article")).toHaveTextContent("300");
  });

  it("opens a transaction detail and restores focus to its row when closed with Escape", async () => {
    const user = userEvent.setup();
    render(<TransactionsPage {...pageProps()} />);

    const rowControl = screen.getByRole("button", { name: /^Spesa/ });
    await user.click(rowControl);
    expect(screen.getByRole("heading", { name: "Spesa" })).toBeVisible();
    expect(screen.getByText("Dettaglio movimento")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Dettaglio movimento")).toBeNull();
    expect(rowControl).toHaveFocus();
  });

  it("opens the standalone editor when navigation changes to a new transaction", () => {
    const rendered = render(<TransactionsPage {...pageProps()} />);

    rendered.rerender(<TransactionsPage {...pageProps()} initialEditorOpen standaloneEditor />);

    expect(screen.getByRole("radio", { name: "Trasferimento" })).toBeVisible();
    expect(screen.getByText("Dettagli finanziari (facoltativi)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Aggiungi ripartizione" })).toBeVisible();
  });
});

function pageProps() {
  const account = Account.create({
    id: "checking",
    name: "Conto corrente",
    type: "checking",
    currency: "EUR",
  });
  const model = buildTransactionsViewModel({
    accounts: [account],
    categories: [],
    transactions: [
      transaction("income", "income", "booked", 120_000n, "2026-07-10"),
      transaction("expense", "expense", "booked", -30_000n, "2026-08-10"),
      transaction("cancelled", "income", "cancelled", 99_000n, "2026-08-11"),
    ],
    transfers: [],
  });

  return {
    model,
    tags: [],
    onCancel: async () => undefined,
    onTrash: async () => undefined,
    onTrashMany: async () => undefined,
    onCreateManual: async () => [],
    onCreateTransfer: async () => undefined,
    onUpdateManual: async () => undefined,
    onExecuteSalaryAllocations: async () => undefined,
  };
}

function transaction(
  id: string,
  kind: "income" | "expense",
  status: "booked" | "cancelled",
  amountMinor: bigint,
  bookedDate: string,
): Transaction {
  return Transaction.create({
    id,
    kind,
    status,
    accountId: "checking",
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate: LocalDate.parse(bookedDate),
  });
}
