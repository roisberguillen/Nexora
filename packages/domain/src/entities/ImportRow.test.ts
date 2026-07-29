import { describe, expect, it } from "vitest";
import { ImportRow } from "./ImportRow";
describe("ImportRow", () => {
  it("richiede una transazione solo per righe importate", () => {
    expect(
      ImportRow.create({
        id: "row-1",
        batchId: "batch-1",
        rowNumber: 2,
        rawJson: "{}",
        status: "needs_review",
      }).status,
    ).toBe("needs_review");
    expect(() =>
      ImportRow.create({
        id: "row-2",
        batchId: "batch-1",
        rowNumber: 2,
        rawJson: "{}",
        status: "imported",
      }),
    ).toThrow("transaction");
  });

  it("conserva il riferimento storico quando un movimento importato viene eliminato", () => {
    const row = ImportRow.create({
      id: "row-deleted",
      batchId: "batch-1",
      rowNumber: 3,
      rawJson: "{}",
      status: "imported",
      deletedTransactionId: "transaction-deleted",
    });
    expect(row.deletedTransactionId).toBe("transaction-deleted");
    expect(row.createdTransactionId).toBeUndefined();
  });

  it("non accetta due riferimenti alla stessa riga importata", () => {
    expect(() =>
      ImportRow.create({
        id: "row-ambiguous",
        batchId: "batch-1",
        rowNumber: 4,
        rawJson: "{}",
        status: "imported",
        createdTransactionId: "transaction-active",
        deletedTransactionId: "transaction-deleted",
      }),
    ).toThrow("exactly one");
  });
});
