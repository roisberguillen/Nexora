import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("espone landmark, navigazione italiana e ricerca locale", () => {
    render(
      <AppShell>
        <h1>Contenuto di prova</h1>
      </AppShell>,
    );

    expect(screen.getByRole("navigation", { name: "Navigazione principale" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nexora/i })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Contenuto di prova");
    expect(screen.getByRole("combobox", { name: "Ricerca globale" })).toBeEnabled();
    expect(
      within(screen.getByRole("navigation", { name: "Navigazione principale" })).getByRole("link", {
        name: "Movimenti",
      }),
    ).toHaveAttribute("href", "./#transactions");
  });

  it("apre e chiude la navigazione mobile con tastiera", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Contenuto di prova</h1>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Apri navigazione" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Pannello di navigazione")).toHaveClass("is-open");
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Pannello di navigazione")).getByRole("button", {
          name: "Chiudi navigazione",
        }),
      ).toHaveFocus(),
    );

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Pannello di navigazione")).not.toHaveClass("is-open");
    expect(trigger).toHaveFocus();
  });

  it("mantiene il focus nel drawer mobile mentre è aperto", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Contenuto di prova</h1>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Apri navigazione" }));
    const navigation = screen.getByLabelText("Pannello di navigazione");
    const close = within(navigation).getByRole("button", { name: "Chiudi navigazione" });
    await waitFor(() => expect(close).toHaveFocus());
    await user.keyboard("{Tab}");
    expect(navigation).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(navigation).toContainElement(document.activeElement as HTMLElement);
  });

  it("raggruppa tutte le route desktop e può ridurre il menu senza perdere la route attiva", async () => {
    const user = userEvent.setup();
    render(
      <AppShell activeRoute="transactions">
        <h1>Contenuto di prova</h1>
      </AppShell>,
    );

    const navigation = screen.getByRole("navigation", { name: "Navigazione principale" });
    expect(within(navigation).getByRole("heading", { name: "Principale" })).toBeVisible();
    expect(within(navigation).getByRole("heading", { name: "Dati" })).toBeVisible();
    expect(within(navigation).getByRole("link", { name: "Movimenti" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(navigation).getByRole("link", { name: "Notifiche" })).toHaveAttribute(
      "href",
      "./#notifications",
    );

    await user.click(screen.getByRole("button", { name: "Riduci menu" }));
    expect(screen.getByLabelText("Pannello di navigazione")).toHaveClass("is-collapsed");
    expect(screen.getByRole("button", { name: "Espandi menu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(navigation).getByRole("link", { name: "Movimenti" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("espone la barra mobile e restituisce l'azione rapida", async () => {
    const user = userEvent.setup();
    let quickActionCount = 0;
    render(
      <AppShell
        activeRoute="transactions"
        quickActions={[
          {
            icon: "transactions",
            label: "Aggiungi nuovo movimento",
            onSelect: () => quickActionCount++,
          },
        ]}
      >
        <h1>Contenuto di prova</h1>
      </AppShell>,
    );

    expect(screen.getByRole("navigation", { name: "Navigazione mobile" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Navigazione mobile" })).getByRole("link", {
        name: "Movimenti",
      }),
    ).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Nuova operazione" }));
    await user.click(screen.getByRole("button", { name: "Aggiungi nuovo movimento" }));
    expect(quickActionCount).toBe(1);
  });

  it("apre la ricerca mobile, gestisce clear, risultati e ritorno del focus", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        searchResults={[
          {
            detail: "Conto",
            href: "./#accounts",
            id: "account-1",
            label: "Conto quotidiano",
          },
        ]}
      >
        <h1>Contenuto di prova</h1>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Apri ricerca globale" });
    await user.click(trigger);
    const search = within(screen.getByRole("dialog", { name: "Ricerca globale" })).getByRole(
      "searchbox",
      { name: "Ricerca globale" },
    );
    expect(search).toHaveFocus();

    await user.type(search, "Conto");
    expect(screen.getByRole("option", { name: /Conto quotidiano/ })).toBeVisible();
    await user.click(
      within(screen.getByRole("dialog", { name: "Ricerca globale" })).getByRole("button", {
        name: "Cancella ricerca",
      }),
    );
    expect(search).toHaveValue("");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("seleziona un risultato della ricerca globale con le frecce e Invio", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        searchResults={[
          {
            detail: "Categoria",
            href: "./#categories",
            id: "category-1",
            label: "Casa",
          },
        ]}
      >
        <h1>Contenuto di prova</h1>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Apri ricerca globale" }));
    const search = within(screen.getByRole("dialog", { name: "Ricerca globale" })).getByRole(
      "searchbox",
      { name: "Ricerca globale" },
    );
    await user.type(search, "Casa");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(window.location.hash).toBe("#categories");
  });
});
