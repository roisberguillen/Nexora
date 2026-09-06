import { InMemoryLedgerRepository, PersistenceError, type BrowserLedger } from "@nexora/database";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

function browserLedger(storageKind: BrowserLedger["storageKind"] = "opfs"): BrowserLedger {
  return {
    repository: new InMemoryLedgerRepository(),
    schemaVersion: 1,
    storageKind,
    close: vi.fn(async () => undefined),
  };
}

describe("Nexora app", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "#overview");
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("mostra lo stato di apertura prima di leggere il ledger", () => {
    render(<App ledgerPromise={new Promise<BrowserLedger>(() => undefined)} />);

    expect(
      screen.getByRole("heading", {
        name: "Preparazione del tuo archivio",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Stiamo verificando e proteggendo i tuoi dati.",
    );
  });

  it("mostra una dashboard vuota senza inserire dati automaticamente", async () => {
    render(<App ledgerPromise={Promise.resolve(browserLedger("indexeddb"))} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.queryByRole("heading", { name: "Il tuo quadro finanziario" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Stato archivio")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Il ledger è pronto per i primi dati",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carica dati dimostrativi" })).toBeEnabled();
    expect(screen.queryByLabelText("Riepilogo finanziario")).not.toBeInTheDocument();
  });

  it("non propone Google Drive all'avvio: il collegamento resta disponibile solo nel backup", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "123-client.apps.googleusercontent.com");
    vi.stubEnv("VITE_GOOGLE_DRIVE_ENABLED", "true");

    render(<App ledgerPromise={Promise.resolve(browserLedger("indexeddb"))} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Collega il tuo account Google" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collega Google Drive" })).not.toBeInTheDocument();
  });

  it("apre la registrazione dal menu rapido", async () => {
    const user = userEvent.setup();
    render(<App ledgerPromise={Promise.resolve(browserLedger())} />);

    await user.click(await screen.findByRole("button", { name: "Nuova operazione" }));
    await user.click(screen.getByRole("button", { name: /Aggiungi nuovo movimento/ }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Nuovo movimento" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Nuovo movimento")).toHaveLength(4);
    expect(screen.getByRole("complementary", { name: "Nuovo movimento" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Uscita" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Entrata" }));
    expect(screen.getByRole("radio", { name: "Entrata" })).toBeChecked();
  });

  it("apre la creazione di un budget dal menu rapido", async () => {
    const user = userEvent.setup();
    render(<App ledgerPromise={Promise.resolve(browserLedger())} />);

    await user.click(await screen.findByRole("button", { name: "Nuova operazione" }));
    expect(screen.queryByRole("button", { name: "Nuova ricorrenza" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Nuovo budget/ }));

    expect(await screen.findByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nuovo budget" })).toBeInTheDocument();
  });

  it("apre la creazione di un conto dal menu rapido", async () => {
    const user = userEvent.setup();
    render(<App ledgerPromise={Promise.resolve(browserLedger())} />);

    await user.click(await screen.findByRole("button", { name: "Nuova operazione" }));
    await user.click(screen.getByRole("button", { name: "Nuovo conto" }));

    expect(await screen.findByRole("heading", { name: "Crea un conto" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nuova operazione" })).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#accounts");
  });

  it("apre il diario finanziario dal menu rapido", async () => {
    const user = userEvent.setup();
    render(<App ledgerPromise={Promise.resolve(browserLedger())} />);

    await user.click(await screen.findByRole("button", { name: "Nuova operazione" }));
    await user.click(screen.getByRole("button", { name: /Diario finanziario/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Diario" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#journal");
  });

  it("apre il centro notifiche locale senza simulare notifiche cloud", async () => {
    window.history.replaceState(null, "", "#notifications");
    render(<App ledgerPromise={Promise.resolve(browserLedger())} />);

    expect(await screen.findByRole("heading", { name: "Notifiche" })).toBeInTheDocument();
    expect(screen.getByText("Backup da verificare")).toBeInTheDocument();
    expect(screen.getByText(/Nessun dato viene inviato online/)).toBeInTheDocument();
  });

  it("proietta il seed sintetico in metriche, conti e attività", async () => {
    const user = userEvent.setup();
    render(<App ledgerPromise={Promise.resolve(browserLedger())} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Carica dati dimostrativi",
      }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Dataset dimostrativo salvato nel dispositivo.",
    );
    const metrics = screen.getByLabelText("Riepilogo finanziario");
    expect(within(metrics).getByText("Disponibilità attuale").closest("article")).toHaveTextContent(
      "5.133,60 €",
    );
    expect(within(metrics).getByText("Entrate del mese").closest("article")).toHaveTextContent(
      "0,00 €",
    );
    expect(within(metrics).getByText("Spese del mese").closest("article")).toHaveTextContent(
      "0,00 €",
    );
    expect(within(metrics).getByText("Risparmio del mese").closest("article")).toHaveTextContent(
      "0,00 €",
    );

    expect(screen.getByText("Conto quotidiano demo → Riserva demo")).toBeInTheDocument();
    expect(screen.getByText("Servizio campione")).toBeInTheDocument();
    const accounts = screen.getByRole("complementary", { name: "Conti" });
    expect(within(accounts).getByText("Conto quotidiano demo").closest("li")).toHaveTextContent(
      "3.747,10 €",
    );
  });

  it("rende visibile l'errore OPFS senza suggerire un fallback implicito", async () => {
    render(
      <App
        ledgerPromise={Promise.reject(
          new PersistenceError("opfs_unavailable", "OPFS unavailable."),
        )}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "I tuoi dati non sono stati modificati.",
    );
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avvia recupero guidato" })).toBeInTheDocument();
    expect(screen.queryByText("OPFS")).not.toBeInTheDocument();
  });

  it("mostra l'anteprima import locale e segnala un file non leggibile", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "#imports");
    render(<App ledgerPromise={Promise.resolve(browserLedger())} />);

    expect(
      await screen.findByRole("heading", { name: "Importa estratti conto" }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Passo 4 sarà disponibile dopo la validazione, deduplica e dry-run."),
    ).not.toBeInTheDocument();

    await user.upload(
      screen.getByLabelText("Seleziona un estratto CSV, XLSX o PDF"),
      new File(["non un workbook"], "movimenti.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "I dati locali non sono stati modificati.",
    );
  });

  it("crea, modifica e archivia un conto mantenendo aggiornata la dashboard", async () => {
    const user = userEvent.setup();
    const ledger = browserLedger("indexeddb");
    window.history.replaceState(null, "", "#accounts");
    render(<App ledgerPromise={Promise.resolve(ledger)} />);

    expect(
      await screen.findByRole("heading", { name: "Gestisci i tuoi conti" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nuovo conto" }));
    await user.type(screen.getByLabelText("Nome conto"), "Portafoglio demo");
    await user.selectOptions(screen.getByLabelText("Tipo"), "cash");
    await user.clear(screen.getByLabelText("Saldo iniziale"));
    await user.type(screen.getByLabelText("Saldo iniziale"), "123,45");
    await user.click(screen.getByRole("button", { name: "Crea conto" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Conto creato e salvato");
    const accountTable = screen.getByRole("table", {
      name: "Conti registrati con saldo, stato e azioni disponibili",
    });
    expect(within(accountTable).getByText("Portafoglio demo")).toBeInTheDocument();
    expect(within(accountTable).getAllByText("123,45 €")).toHaveLength(2);

    await user.click(within(accountTable).getByRole("button", { name: "Modifica" }));
    await user.clear(screen.getByLabelText("Nome conto"));
    await user.type(screen.getByLabelText("Nome conto"), "Contanti demo");
    await user.clear(screen.getByLabelText("Saldo iniziale"));
    await user.type(screen.getByLabelText("Saldo iniziale"), "150,00");
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Modifiche del conto salvate");
    expect(within(accountTable).getByText("Contanti demo")).toBeInTheDocument();

    await user.click(within(accountTable).getByRole("button", { name: "Archivia" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Conto archiviato");
    expect(within(accountTable).getByText("Archiviato")).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("navigation", { name: "Navigazione principale" })).getByRole("link", {
        name: "Panoramica",
      }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Riepilogo finanziario")).toHaveTextContent("0,00 €");
  }, 15_000);
});
