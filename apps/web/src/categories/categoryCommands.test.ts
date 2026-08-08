import { InMemoryLedgerRepository } from "@nexora/database";
import { createSystemCategories } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import {
  createLedgerCategory,
  installDefaultCategoryTaxonomy,
  updateLedgerCategory,
} from "./categoryCommands";

describe("category commands", () => {
  it("creates and moves a subcategory without changing historical references", async () => {
    const repository = new InMemoryLedgerRepository();
    const macro = await createLedgerCategory(
      repository,
      { name: "Trasporti", kindScope: "expense" },
      () => "macro",
    );
    const otherMacro = await createLedgerCategory(
      repository,
      { name: "Casa", kindScope: "expense" },
      () => "other-macro",
    );
    await createLedgerCategory(
      repository,
      { name: "Carburante", kindScope: "expense", parentId: macro.id },
      () => "child",
    );

    await updateLedgerCategory(repository, "child", {
      name: "Carburante",
      kindScope: "expense",
      parentId: otherMacro.id,
      isArchived: false,
    });

    expect((await repository.findCategoryById("child"))?.parentId).toBe(otherMacro.id);
  });

  it("installs the curated taxonomy only after an explicit request on a fresh ledger", async () => {
    const repository = new InMemoryLedgerRepository();
    for (const category of createSystemCategories()) await repository.saveCategory(category);

    await installDefaultCategoryTaxonomy(repository);

    const categories = await repository.listCategories();
    expect(categories.some((category) => category.name === "Casa e utenze")).toBe(true);
    expect(
      categories.some((category) => category.name === "Affitto" && category.parentId !== undefined),
    ).toBe(true);
    await installDefaultCategoryTaxonomy(repository);
    expect((await repository.listCategories()).length).toBe(categories.length);
  });
});
