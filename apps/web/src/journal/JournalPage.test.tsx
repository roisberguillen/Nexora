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
    expect(screen.getByText("Sintesi automatica")).toBeVisible();
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
});
