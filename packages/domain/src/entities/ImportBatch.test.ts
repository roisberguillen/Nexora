import { describe, expect, it } from "vitest";

import { ImportBatch, validateImportCommit } from "./ImportBatch";
import { ImportRow } from "./ImportRow";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Transaction } from "./Transaction";

const sourceSha256 = "a".repeat(64);

describe("ImportBatch", () => {
  it("consente il passaggio previewed, committed, undone", () => {
    const batch = ImportBatch.create({
      id: "batch-1",
      importerType: "money_manager_xlsx",
      rowsTotal: 2,
      sourceFilename: "movimenti.xlsx",
      sourceSha256,
    });
    const committed = batch.commit({ rowsImported: 1, rowsSkipped: 1, rowsFailed: 0 });
    expect(committed.status).toBe("committed");
    expect(committed.undo().status).toBe("undone");
  });

  it("rifiuta conteggi e transizioni non validi", () => {
    expect(() =>
      ImportBatch.create({
        id: "batch-1",
        importerType: "money_manager_xlsx",
        rowsTotal: 1,
        rowsImported: 2,
        sourceFilename: "movimenti.xlsx",
        sourceSha256,
      }),
    ).toThrow("exceed");
    const batch = ImportBatch.create({
      id: "batch-1",
      importerType: "money_manager_xlsx",
      rowsTotal: 1,
      sourceFilename: "movimenti.xlsx",
      sourceSha256,
    });
    expect(() => batch.undo()).toThrow("committed");
  });

  it("richiede una corrispondenza esatta fra righe importate e transazioni", () => {
    const batch = ImportBatch.create({
      id: "batch-1",
      importerType: "money_manager_xlsx",
      rowsTotal: 1,
      sourceFilename: "movimenti.xlsx",
      sourceSha256,
    });
    const transaction = Transaction.create({
      id: "transaction-1",
      kind: "income",
      status: "booked",
      accountId: "account-1",
      amount: Money.fromMinor(100n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-28"),
      source: "import",
      importBatchId: batch.id,
      sourceFingerprint: "b".repeat(64),
    });
    const row = ImportRow.create({
      id: "row-1",
      batchId: batch.id,
      rowNumber: 2,
      rawJson: "{}",
      status: "imported",
      createdTransactionId: transaction.id,
    });
    expect(validateImportCommit(batch, [row], [transaction]).status).toBe("committed");
  });
});
