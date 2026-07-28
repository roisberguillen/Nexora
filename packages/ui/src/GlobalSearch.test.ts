import { describe, expect, it } from "vitest";

import { filterGlobalSearchResults } from "./GlobalSearch";

describe("filterGlobalSearchResults", () => {
  const results = [
    { id: "account-1", href: "./#accounts", label: "Conto quotidiano", detail: "Conto" },
    {
      id: "transaction-1",
      href: "./#transactions",
      label: "Spesa supermercato",
      detail: "Spesa · Conto quotidiano",
    },
  ] as const;

  it("cerca senza distinzione tra maiuscole e minuscole", () => {
    expect(filterGlobalSearchResults(results, "SUPERMERCATO")).toEqual([results[1]]);
  });

  it("non presenta risultati quando la query è vuota", () => {
    expect(filterGlobalSearchResults(results, "  ")).toEqual([]);
  });
});
