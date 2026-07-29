import { Category, DomainError } from "../index";
import { describe, expect, it } from "vitest";

import { validateCategoryMerge } from "./dataManagement";

describe("category data management", () => {
  it("protects system categories and archived targets", () => {
    const expense = Category.create({ id: "expense", name: "Spese", kindScope: "expense" });
    const archived = Category.create({
      id: "archived",
      name: "Archivio",
      kindScope: "expense",
      isArchived: true,
    });
    expect(() => validateCategoryMerge(expense, archived)).toThrow(DomainError);
    expect(() =>
      validateCategoryMerge(
        Category.create({ id: "system-expense", name: "Spese", kindScope: "expense" }),
        expense,
      ),
    ).toThrow(DomainError);
  });
});
