import { MonthlyJournal } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JournalPage } from "./JournalPage";

describe("JournalPage", () => {
  it("renders empty state, month summary and accessible 1–5 control", () => {
    render(
      <JournalPage
        investments={[]}
        journals={[]}
        onDelete={async () => undefined}
        onSave={async () => undefined}
        transactions={[]}
      />,
    );
    expect(screen.getByText("Nessuna riflessione")).toBeVisible();
    expect(screen.getByRole("button", { name: "Nuova nota" })).toBeVisible();
    expect(screen.getByText("Sintesi automatica")).toBeVisible();
    expect(document.querySelector(".journal-summary-content")).toContainElement(
      screen.getByText("Questa sintesi è derivata dai dati locali e non modifica il ledger."),
    );
    expect(document.querySelectorAll(".journal-summary-content .metric-label")).toHaveLength(4);
    expect(document.querySelectorAll(".journal-summary-content .metric-value")).toHaveLength(4);
    expect(screen.getByLabelText("Percezione di controllo")).toBeVisible();
  });

  it("edits and confirms deletion of only the selected monthly reflection", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => undefined);
    const onSave = vi.fn(async () => undefined);
    const journal = MonthlyJournal.create({
      id: "journal-august",
      note: "Mese stabile",
      nextMonthGoals: "Ridurre le spese discrezionali",
      perceivedControl: 4,
      period: "2026-08",
    });
    render(
      <JournalPage
        investments={[]}
        journals={[journal]}
        onDelete={onDelete}
        onSave={onSave}
        transactions={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByLabelText("Come è andato il mese?")).toHaveValue("Mese stabile");
    await user.click(screen.getByRole("button", { name: "Salva diario" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ period: "2026-08", perceivedControl: 4 }),
      journal.id,
    );

    await user.click(screen.getByRole("button", { name: "Elimina…" }));
    expect(screen.getByRole("dialog", { name: "Eliminare questo diario?" })).toHaveTextContent(
      "non movimenti, budget o saldi",
    );
    await user.click(screen.getByRole("button", { name: "Elimina diario" }));
    expect(onDelete).toHaveBeenCalledWith(journal.id);
  });

  it("keeps journal entries ordered from newest to oldest", () => {
    const older = MonthlyJournal.create({
      id: "journal-june",
      period: "2026-06",
      note: "nota precedente",
    });
    const newer = MonthlyJournal.create({
      id: "journal-august",
      period: "2026-08",
      note: "nota recente",
    });
    render(
      <JournalPage
        investments={[]}
        journals={[older, newer]}
        onDelete={async () => undefined}
        onSave={async () => undefined}
        transactions={[]}
      />,
    );
    const entries = screen.getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("Ag\u006fsto 2026");
    expect(entries[1]).toHaveTextContent("Giugno 2026");
  });

  it("cancels an edit without changing the saved journal", async () => {
    const user = userEvent.setup();
    const journal = MonthlyJournal.create({
      id: "journal-current",
      period: "2026-09",
      note: "Salvata",
    });
    render(
      <JournalPage
        investments={[]}
        journals={[journal]}
        onDelete={async () => undefined}
        onSave={async () => undefined}
        transactions={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Modifica" }));
    await user.click(screen.getByLabelText("Come è andato il mese?"));
    await user.keyboard(" modifica");
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.getByLabelText("Mesi registrati")).toHaveTextContent("Salvata");
  });
});
