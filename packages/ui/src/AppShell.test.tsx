import { render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("searchbox", { name: "Ricerca globale" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Movimenti" })).toHaveAttribute(
      "href",
      "./#transactions",
    );
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

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Pannello di navigazione")).not.toHaveClass("is-open");
  });
});
