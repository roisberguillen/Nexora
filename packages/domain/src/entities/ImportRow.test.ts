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
});
