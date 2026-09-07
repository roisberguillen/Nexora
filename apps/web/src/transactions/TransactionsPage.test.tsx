import { Account, LocalDate, Money, Transaction, Transfer } from "@nexora/domain";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("clears the movement search and returns focus to the filter trigger after Escape", async () => {
    const user = userEvent.setup();
    render(<TransactionsPage {...pageProps()} />);

    const search = screen.getByRole("searchbox", { name: "Cerca nei movimenti" });
    await user.type(search, "Spesa");
    await user.click(screen.getByRole("button", { name: "Cancella ricerca movimenti" }));
    expect(search).toHaveValue("");

    const filters = screen.getByRole("button", { name: "Filtri" });
    await user.click(filters);
    expect(screen.getByRole("dialog", { name: "Filtri movimenti" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Filtri movimenti" })).toBeNull();
    expect(filters).toHaveFocus();
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
    await waitFor(() => expect(rowControl).toHaveFocus());
  });

  it("opens the standalone editor when navigation changes to a new transaction", () => {
    const rendered = render(<TransactionsPage {...pageProps()} />);

    rendered.rerender(<TransactionsPage {...pageProps()} initialEditorOpen standaloneEditor />);

    expect(screen.getByRole("radio", { name: "Trasferimento" })).toBeVisible();
    const advancedDetails = screen.getByText("Altri dettagli").closest("details");
    expect(advancedDetails).not.toBeNull();
    expect(advancedDetails).not.toHaveProperty("open", true);
  });

  it("creates an income through the banking field order and existing command contract", async () => {
    const user = userEvent.setup();
    const onCreateManual = vi.fn(async () => [] as readonly string[]);
    render(
      <TransactionsPage
        {...pageProps()}
        initialEditorOpen
        onCreateManual={onCreateManual}
        standaloneEditor
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Entrata" }));
    await user.type(screen.getByRole("textbox", { name: "Importo" }), "12,50");
    await user.type(screen.getByLabelText("Controparte"), "Datore di lavoro");
    await user.type(screen.getByLabelText("Descrizione"), "Rimborso");
    await user.click(screen.getByRole("button", { name: "Salva movimento" }));

    expect(onCreateManual).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "checking",
        amountMinor: 1_250n,
        kind: "income",
        payee: "Datore di lavoro",
        description: "Rimborso",
      }),
    );
  });

  it("creates an expense with the existing signed minor-unit contract", async () => {
    const user = userEvent.setup();
    const onCreateManual = vi.fn(async () => [] as readonly string[]);
    render(
      <TransactionsPage
        {...pageProps()}
        initialEditorOpen
        onCreateManual={onCreateManual}
        standaloneEditor
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Importo" }), "12,50");
    await user.click(screen.getByRole("button", { name: "Salva movimento" }));

    expect(onCreateManual).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "checking",
        amountMinor: -1_250n,
        kind: "expense",
      }),
    );
  });

  it("guards the save command against a synchronous double submit", async () => {
    let resolveSave: ((value: readonly string[]) => void) | undefined;
    const onCreateManual = vi.fn(
      () => new Promise<readonly string[]>((resolve) => (resolveSave = resolve)),
    );
    render(
      <TransactionsPage
        {...pageProps()}
        initialEditorOpen
        onCreateManual={onCreateManual}
        standaloneEditor
      />,
    );

    const form = screen.getByRole("button", { name: "Salva movimento" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Importo" }), {
      target: { value: "12,50" },
    });
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(onCreateManual).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Salvataggio…" })).toBeDisabled();
    resolveSave?.([]);
  });

  it("keeps validation failures readable and preserves the editor", async () => {
    const user = userEvent.setup();
    const onCreateManual = vi.fn(async () => [] as readonly string[]);
    render(
      <TransactionsPage
        {...pageProps()}
        initialEditorOpen
        onCreateManual={onCreateManual}
        standaloneEditor
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Importo" }), "12,345");
    await user.click(screen.getByRole("button", { name: "Salva movimento" }));

    expect(onCreateManual).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/accetta al massimo 2 decimali/i);
    expect(screen.getByRole("textbox", { name: "Importo" })).toHaveValue("12,345");
  });

  it("preserves existing expense classifications when editing", async () => {
    const user = userEvent.setup();
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
        Transaction.create({
          id: "expense-with-details",
          kind: "expense",
          status: "booked",
          accountId: account.id,
          amount: Money.fromMinor(-1_250n, "EUR"),
          bookedDate: LocalDate.parse("2026-08-18"),
          expenseExceptionality: "ordinary",
          expenseVariability: "fixed",
        }),
      ],
      transfers: [],
    });
    render(<TransactionsPage {...pageProps()} model={model} />);

    await user.click(screen.getByRole("button", { name: "Azioni per Spesa" }));
    await user.click(screen.getByRole("menuitem", { name: "Modifica" }));
    await user.click(screen.getByText("Altri dettagli"));

    expect(screen.getByRole("radio", { name: "Fissa" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Ordinario" })).toBeChecked();
  });

  it("keeps a registered transfer in read-only detail and never exposes edit", async () => {
    const user = userEvent.setup();
    const origin = Account.create({
      id: "origin",
      name: "Conto origine",
      type: "checking",
      currency: "EUR",
    });
    const destination = Account.create({
      id: "destination",
      name: "Conto destinazione",
      type: "savings",
      currency: "EUR",
    });
    const debit = Transaction.create({
      id: "transfer-debit",
      kind: "transfer",
      status: "booked",
      accountId: origin.id,
      amount: Money.fromMinor(-18_500n, "EUR"),
      bookedDate: LocalDate.parse("2026-08-18"),
      source: "manual",
      description: "Giroconto",
    });
    const credit = Transaction.create({
      id: "transfer-credit",
      kind: "transfer",
      status: "booked",
      accountId: destination.id,
      amount: Money.fromMinor(18_500n, "EUR"),
      bookedDate: LocalDate.parse("2026-08-18"),
      source: "manual",
      description: "Giroconto",
    });
    const transfer = Transfer.create({
      id: "transfer-1",
      debitTransaction: debit,
      creditTransaction: credit,
    });
    const model = buildTransactionsViewModel({
      accounts: [origin, destination],
      categories: [],
      transactions: [debit, credit],
      transfers: [transfer],
    });
    render(<TransactionsPage {...pageProps()} model={model} />);

    await user.click(screen.getByRole("button", { name: /^Giroconto/ }));
    expect(screen.getByText("Conto origine")).toBeVisible();
    expect(screen.getByText("Conto destinazione")).toBeVisible();
    expect(screen.queryByRole("button", { name: /modifica/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Modifica" })).toBeNull();
  });

  it("blocks the impossible transfer-edit state without calling either save callback", async () => {
    const user = userEvent.setup();
    const onCreateTransfer = vi.fn(async () => undefined);
    const onUpdateManual = vi.fn(async () => undefined);
    render(
      <TransactionsPage
        {...pageProps()}
        initialEditorOpen
        onCreateTransfer={onCreateTransfer}
        onUpdateManual={onUpdateManual}
        standaloneEditor
      />,
    );

    await user.click(screen.getByRole("button", { name: "Azioni per Spesa" }));
    await user.click(screen.getByRole("menuitem", { name: "Modifica" }));
    await user.click(screen.getByRole("radio", { name: "Trasferimento" }));
    await user.selectOptions(screen.getByLabelText("Conto destinazione"), "savings");
    await user.type(screen.getByRole("textbox", { name: "Importo" }), "10,00");
    await user.click(screen.getByRole("button", { name: "Salva movimento" }));

    expect(onCreateTransfer).not.toHaveBeenCalled();
    expect(onUpdateManual).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "I trasferimenti registrati non possono essere modificati",
    );
  });
});

function pageProps() {
  const account = Account.create({
    id: "checking",
    name: "Conto corrente",
    type: "checking",
    currency: "EUR",
  });
  const savings = Account.create({
    id: "savings",
    name: "Risparmi",
    type: "savings",
    currency: "EUR",
  });
  const model = buildTransactionsViewModel({
    accounts: [account, savings],
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
