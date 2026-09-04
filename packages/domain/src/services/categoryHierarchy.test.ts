import { Category, DomainError } from "../index";
import { describe, expect, it } from "vitest";

import { validateCategoryHierarchy, validateCategoryUniqueness } from "./categoryHierarchy";

const macro = () => Category.create({ id: "macro", name: "Casa", kindScope: "expense" });
const child = (parentId = "macro") =>
  Category.create({ id: "child", name: "Affitto", kindScope: "expense", parentId });

describe("category hierarchy", () => {
  it("accepts one macro category and one compatible subcategory", () => {
    expect(() => validateCategoryHierarchy([macro(), child()])).not.toThrow();
  });

  it.each([
    ["missing parent", [child("missing")]],
    [
      "third level",
      [
        macro(),
        child(),
        Category.create({
          id: "third",
          name: "Dettaglio",
          kindScope: "expense",
          parentId: "child",
        }),
      ],
    ],
    [
      "incompatible scope",
      [
        macro(),
        Category.create({
          id: "income",
          name: "Stipendio",
          kindScope: "income",
          parentId: "macro",
        }),
      ],
    ],
    [
      "archived parent",
      [
        Category.create({ id: "macro", name: "Casa", kindScope: "expense", isArchived: true }),
        child(),
      ],
    ],
  ])("rejects %s", (_label, categories) => {
    expect(() => validateCategoryHierarchy(categories)).toThrow(DomainError);
  });

  it("rejects a self-reference before persistence", () => {
    expect(() =>
      Category.create({ id: "self", name: "Errore", kindScope: "expense", parentId: "self" }),
    ).toThrow(DomainError);
  });

  it("allows a both macro to contain income and expense children", () => {
    const both = Category.create({ id: "both", name: "Condivisa", kindScope: "both" });
    expect(() =>
      validateCategoryHierarchy([
        both,
        Category.create({ id: "income", name: "Entrata", kindScope: "income", parentId: both.id }),
        Category.create({ id: "expense", name: "Spesa", kindScope: "expense", parentId: both.id }),
      ]),
    ).not.toThrow();
  });

  it("rejects duplicate names within the same parent, ignoring case and whitespace", () => {
    expect(() =>
      validateCategoryUniqueness([
        macro(),
        Category.create({ id: "duplicate", name: " casa ", kindScope: "income" }),
      ]),
    ).toThrow(DomainError);
    expect(() =>
      validateCategoryUniqueness([
        macro(),
        child(),
        Category.create({
          id: "other-child",
          name: "Affitto",
          kindScope: "expense",
          parentId: "other-macro",
        }),
        Category.create({ id: "other-macro", name: "Altro", kindScope: "expense" }),
      ]),
    ).not.toThrow();
  });
});
