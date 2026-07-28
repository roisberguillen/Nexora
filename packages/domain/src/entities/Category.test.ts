import { describe, expect, it } from "vitest";

import { DomainError } from "../errors/DomainError";
import { Category, type CategoryKindScope } from "./Category";

describe("Category", () => {
  it("limita entrate e spese in base allo scope", () => {
    const income = Category.create({
      id: "income-category",
      name: "Entrate Demo",
      kindScope: "income",
    });
    const both = Category.create({
      id: "both-category",
      name: "Categoria Demo",
      kindScope: "both",
    });

    expect(income.accepts("income")).toBe(true);
    expect(income.accepts("expense")).toBe(false);
    expect(both.accepts("income")).toBe(true);
    expect(both.accepts("expense")).toBe(true);
    expect(both.accepts("transfer")).toBe(false);
  });

  it("rifiuta scope sconosciuti anche a runtime", () => {
    expect(() =>
      Category.create({
        id: "invalid-category",
        name: "Categoria Demo",
        kindScope: "unknown" as CategoryKindScope,
      }),
    ).toThrowError(DomainError);
  });
});
