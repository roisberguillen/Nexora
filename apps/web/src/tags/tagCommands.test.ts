import { InMemoryLedgerRepository } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { createLedgerTag, updateLedgerTag } from "./tagCommands";

describe("tag commands", () => {
  it("crea, modifica e archivia un tag persistente", async () => {
    const repository = new InMemoryLedgerRepository();
    const tag = await createLedgerTag(repository, { name: "Lavoro" }, () => "tag-work");

    expect(await repository.listTags()).toEqual([tag]);

    const updated = await updateLedgerTag(repository, tag.id, {
      name: "Lavoro fotografico",
      isArchived: true,
    });

    expect(await repository.listTags()).toEqual([updated]);
  });

  it("rifiuta nomi semanticamente duplicati senza alterare il tag originale", async () => {
    const repository = new InMemoryLedgerRepository();
    const original = await createLedgerTag(repository, { name: "Lavoro" }, () => "tag-work");

    await expect(
      createLedgerTag(repository, { name: " lavoro " }, () => "tag-work-copy"),
    ).rejects.toMatchObject({ code: "duplicate_entity" });
    await expect(repository.listTags()).resolves.toEqual([original]);
  });
});
