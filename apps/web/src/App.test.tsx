import { InMemoryLedgerRepository, PersistenceError, type BrowserLedger } from "@nexora/database";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  });

  it("mostra lo stato di apertura prima di leggere il ledger", () => {
    render(<App ledgerPromise={new Promise<BrowserLedger>(() => undefined)} />);

    expect(
      screen.getByRole("heading", {
        name: "Preparazione dell’archivio locale",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nexora sta verificando backend");
  });

  it("mostra una dashboard vuota senza inserire dati automaticamente", async () => {
    render(<App ledgerPromise={Promise.resolve(browserLedger("indexeddb"))} />);

    expect(
      await screen.findByRole("heading", { name: "Il tuo quadro finanziario" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Stato archivio")).toHaveTextContent("IndexedDB·Schema 1");
    expect(
      screen.getByRole("heading", {
        name: "Il ledger è pronto per i primi dati",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carica dati dimostrativi" })).toBeEnabled();
    expect(screen.queryByLabelText("Riepilogo finanziario")).not.toBeInTheDocument();
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
    expect(within(metrics).getByText("Patrimonio locale").closest("article")).toHaveTextContent(
      "5.133,60 €",
    );
    expect(within(metrics).getByText("Entrate").closest("article")).toHaveTextContent(
      "+2.400,00 €",
    );
    expect(within(metrics).getByText("Spese").closest("article")).toHaveTextContent("896,40 €");
    expect(within(metrics).getByText("Saldo dei flussi").closest("article")).toHaveTextContent(
      "+1.503,60 €",
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
      "Nessun archivio IndexedDB alternativo è stato aperto.",
    );
    expect(screen.getByRole("button", { name: "Ricarica Nexora" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("link", { name: "Panoramica" }));
    expect(
      await screen.findByRole("heading", { name: "Il tuo quadro finanziario" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Riepilogo finanziario")).toHaveTextContent("150,00 €");
  });
});
