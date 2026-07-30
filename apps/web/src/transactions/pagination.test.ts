import { describe, expect, it } from "vitest";

import { paginateTransactions, transactionPageSize } from "./pagination";

describe("paginateTransactions", () => {
  it("limita il DOM a cento righe anche con centomila movimenti", () => {
    const result = paginateTransactions(
      Array.from({ length: 100_000 }, (_, index) => index),
      1_000,
    );

    expect(result.pageCount).toBe(1_000);
    expect(result.currentPage).toBe(1_000);
    expect(result.items).toHaveLength(transactionPageSize);
    expect(result.items[0]).toBe(99_900);
    expect(result.items.at(-1)).toBe(99_999);
  });

  it("normalizza le pagine fuori intervallo", () => {
    expect(paginateTransactions(["a"], 0)).toMatchObject({ currentPage: 1, pageCount: 1 });
    expect(paginateTransactions(["a"], 99)).toMatchObject({ currentPage: 1, pageCount: 1 });
  });
});
