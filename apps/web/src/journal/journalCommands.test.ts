import { InMemoryLedgerRepository } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { deleteMonthlyJournal, saveMonthlyJournal } from "./journalCommands";

describe("journal commands", () => {
  it("crea e modifica il diario del mese nello stesso record", async () => {
    const repository = new InMemoryLedgerRepository();
    const created = await saveMonthlyJournal(
      repository,
      { period: "2026-07", note: "Mese stabile", perceivedControl: 4 },
      undefined,
      () => "journal-july",
    );
    const updated = await saveMonthlyJournal(
      repository,
      { period: "2026-07", nextMonthGoals: "Ridurre le spese discrezionali" },
      created.id,
    );

    expect(await repository.listMonthlyJournals()).toEqual([updated]);
  });
});

it("elimina solo il diario selezionato", async () => {
  const repository = new InMemoryLedgerRepository();
  const journal = await saveMonthlyJournal(
    repository,
    { period: "2026-08", note: "Mese stabile" },
    undefined,
    () => "journal-august",
  );

  await deleteMonthlyJournal(repository, journal.id);
  expect(await repository.listMonthlyJournals()).toEqual([]);
});
