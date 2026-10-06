import { LocalDate, Money, Transaction, type TrashedTransaction } from "@nexora/domain";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./SettingsPage";

const trashedTransaction: TrashedTransaction = {
  transaction: Transaction.create({
    id: "trashed-expense",
    kind: "expense",
    status: "booked",
    accountId: "account-1",
    amount: Money.fromMinor(-1250n, "EUR"),
    bookedDate: LocalDate.parse("2026-07-29"),
    source: "manual",
    description: "Spesa nel cestino",
  }),
  deletedAt: "2026-08-29T10:00:00.000Z",
  deletionGroupId: "transaction:trashed-expense",
};

describe("SettingsPage destructive flows", () => {
  it("non abilita il reset finanziario con frase errata e consente annullamento", async () => {
    const user = userEvent.setup();
    const reset = vi.fn(async () => undefined);
    render(<SettingsPage onResetFinancialData={reset} />);

    await user.click(screen.getByRole("button", { name: "Reset dati finanziari" }));
    const confirm = screen.getByRole("button", { name: "Conferma reset" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Frase di conferma reset"), "RESETTA DATI");
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Annulla" }));

    expect(screen.queryByRole("dialog", { name: "Conferma reset dati finanziari" })).toBeNull();
    expect(reset).not.toHaveBeenCalled();
  });

  it("rende accessibile un errore di reset senza chiudere il contesto", async () => {
    const user = userEvent.setup();
    const reset = vi.fn(async () => Promise.reject(new Error("synthetic failure")));
    render(<SettingsPage onResetFinancialData={reset} />);

    await user.click(screen.getByRole("button", { name: "Reset dati finanziari" }));
    await user.type(screen.getByLabelText("Frase di conferma reset"), "RESETTA DATI FINANZIARI");
    await user.click(screen.getByLabelText("Procedi senza backup"));
    await user.click(screen.getByRole("button", { name: "Conferma reset" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Reset non completato");
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("consente il reset finanziario senza passphrase dopo la rinuncia esplicita al backup", async () => {
    const user = userEvent.setup();
    const reset = vi.fn(async () => undefined);
    render(
      <SettingsPage onCreateResetBackup={async () => "unused"} onResetFinancialData={reset} />,
    );

    await user.click(screen.getByRole("button", { name: "Reset dati finanziari" }));
    expect(screen.getByText(/Il backup è consigliato ma non obbligatorio/i)).toBeVisible();
    await user.type(screen.getByLabelText("Frase di conferma reset"), "RESETTA DATI FINANZIARI");
    expect(screen.getByRole("button", { name: "Conferma reset" })).toBeDisabled();

    await user.click(screen.getByLabelText("Procedi senza backup"));
    await user.click(screen.getByRole("button", { name: "Conferma reset" }));

    await waitFor(() => expect(reset).toHaveBeenCalledWith({}));
  });

  it("richiede una conferma distinta prima della purge e previene il doppio click", async () => {
    const user = userEvent.setup();
    let resolvePurge: (() => void) | undefined;
    const purge = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePurge = resolve;
        }),
    );
    render(
      <SettingsPage
        onPurgeTransaction={purge}
        onRestoreTransaction={async () => undefined}
        trashedTransactions={[trashedTransaction]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Elimina definitivamente" }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Elimina definitivamente",
    });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(purge).toHaveBeenCalledTimes(1);
    resolvePurge?.();
    const purgeStatus = await screen.findByText("Movimento eliminato definitivamente.");
    expect(purgeStatus).toHaveAttribute("role", "status");
  });

  it("svuota il cestino solo dopo una conferma esplicita", async () => {
    const user = userEvent.setup();
    const purge = vi.fn(async () => undefined);
    render(
      <SettingsPage
        onPurgeTransactions={purge}
        onRestoreTransaction={async () => undefined}
        trashedTransactions={[trashedTransaction]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Svuota cestino" }));
    expect(purge).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog", { name: "Svuotare il cestino?" })).getByRole("button", {
        name: "Svuota cestino",
      }),
    );
    await waitFor(() => expect(purge).toHaveBeenCalledWith(["trashed-expense"]));
    const purgeAllStatus = await screen.findByText("Cestino svuotato definitivamente.");
    expect(purgeAllStatus).toHaveAttribute("role", "status");
  });

  it("mostra un errore accessibile se il ripristino non riesce", async () => {
    const user = userEvent.setup();
    render(
      <SettingsPage
        onRestoreTransaction={async () => Promise.reject(new Error("synthetic failure"))}
        trashedTransactions={[trashedTransaction]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ripristina" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ripristino non completato");
    expect(screen.getByText(/Spesa nel cestino/)).toBeVisible();
  });

  it("protegge il ripristino totale con una frase distinta e consente l'annullamento", async () => {
    const user = userEvent.setup();
    const resetApplication = vi.fn(async () => ({
      local: "succeeded" as const,
      cloudRequested: false,
      cloudDeleted: 0,
      cloudRemaining: 0,
      cloudErrors: [],
    }));
    render(<SettingsPage onResetApplication={resetApplication} />);

    await user.click(screen.getByRole("button", { name: "Ripristino totale dell’app" }));
    const dialog = screen.getByRole("dialog", { name: "Conferma ripristino totale" });
    expect(within(dialog).getByText(/Digita RIPRISTINA NEXORA per confermare/i)).toBeVisible();
    expect(within(dialog).queryByLabelText(/passphrase/i)).toBeNull();
    const confirm = within(dialog).getByRole("button", { name: "Ripristina app" });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByLabelText("Frase di conferma ripristino totale"),
      "RIPRISTINA DATI",
    );
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Annulla" }));

    expect(screen.queryByRole("dialog", { name: "Conferma ripristino totale" })).toBeNull();
    expect(resetApplication).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Ripristino totale dell’app" }));
    await user.type(
      screen.getByLabelText("Frase di conferma ripristino totale"),
      "RIPRISTINA NEXORA",
    );
    await user.click(screen.getByRole("button", { name: "Ripristina app" }));
    await waitFor(() => expect(resetApplication).toHaveBeenCalledOnce());

    expect(resetApplication).toHaveBeenLastCalledWith({ deleteCloud: false });
  });

  it("richiede backup e PIN prima del reset quando il blocco app è attivo", async () => {
    const user = userEvent.setup();
    const reset = vi.fn(async () => undefined);
    const createBackup = vi.fn(async () => "cafebabecafe");
    render(
      <SettingsPage
        onCreateResetBackup={createBackup}
        onResetFinancialData={reset}
        requiresResetPin
      />,
    );
    await user.click(screen.getByRole("button", { name: "Reset dati finanziari" }));
    expect(screen.getByText(/Se non li ricordi, usa il ripristino totale/i)).toBeVisible();
    await user.type(screen.getByLabelText("Passphrase backup reset"), "passphrase-sicura");
    await user.click(screen.getByRole("button", { name: "Crea backup verificato" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Backup verificato pronto");
    await user.type(screen.getByLabelText("Frase di conferma reset"), "RESETTA DATI FINANZIARI");
    await user.type(screen.getByLabelText("PIN reset finanziario"), "4937");
    await user.click(screen.getByRole("button", { name: "Conferma reset" }));
    await waitFor(() =>
      expect(reset).toHaveBeenCalledWith({ backupChecksumPrefix: "cafebabecafe", pin: "4937" }),
    );
    expect(screen.queryByLabelText("Elimina backup Google Drive")).toBeNull();
  });

  it("intrappola il focus nel dialog, chiude con Escape e lo restituisce al controllo invocante", async () => {
    const user = userEvent.setup();
    render(<SettingsPage onResetFinancialData={async () => undefined} />);

    const trigger = screen.getByRole("button", { name: "Reset dati finanziari" });
    trigger.focus();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog", { name: "Conferma reset dati finanziari" });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Conferma reset dati finanziari" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("rende modificabile il giorno di inizio del mese finanziario", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(screen.queryByLabelText("Valuta principale")).toBeNull();
    const select = screen.getByLabelText("Giorno di inizio del mese finanziario");
    expect(select).toHaveValue("1");
    await user.selectOptions(select, "15");
    expect(select).toHaveValue("15");
    expect(screen.getByText(/La modifica cambia i riepiloghi/i)).toBeVisible();
    expect(screen.getByRole("region", { name: "Calendario finanziario" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Gestione dati" })).toBeVisible();
  });

  it("collega e disattiva un host solo dopo averlo verificato", async () => {
    const user = userEvent.setup();
    render(
      <SettingsPage
        onProbeLocalHost={async () => ({
          apiVersion: 1,
          appUrl: "https://nexora.home",
          runtimeState: "running",
          binding: "lan",
        })}
      />,
    );
    expect(screen.getByRole("region", { name: "Connessione dispositivi" })).toHaveTextContent(
      "Solo locale",
    );
    await user.click(screen.getByRole("button", { name: "Attiva host" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Apri Nexora da: https://nexora.home",
    );
    expect(screen.getByText("Host collegato")).toBeVisible();
    const browserLink = screen.getByRole("link", { name: "Apri Nexora nel browser locale" });
    expect(browserLink).toHaveAttribute("href", "https://nexora.home");
    expect(browserLink).toHaveAttribute("target", "_blank");
    expect(browserLink).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(screen.getByRole("button", { name: "Disattiva host" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Host disattivato in questo browser",
    );
    expect(screen.queryByRole("link", { name: "Apri Nexora nel browser locale" })).toBeNull();
  });
});
