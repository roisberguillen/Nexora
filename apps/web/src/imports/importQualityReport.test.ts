import { ImportBatch } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { buildImportQualityReport } from "./importQualityReport";

describe("import quality report", () => {
  it("accounts every imported, skipped and failed row", () => {
    const batch = ImportBatch.create({
      id: "batch-report",
      importerType: "generic_csv",
      sourceFilename: "report.csv",
      sourceSha256: "a".repeat(64),
      rowsTotal: 4,
      status: "committed",
      rowsImported: 2,
      rowsSkipped: 1,
      rowsFailed: 1,
    });
    expect(buildImportQualityReport([batch])).toEqual({
      batches: 1,
      rowsTotal: 4,
      rowsImported: 2,
      rowsSkipped: 1,
      rowsFailed: 1,
      completionPercent: 100,
    });
  });

  it("reports an empty ledger as fully accounted", () => {
    expect(buildImportQualityReport([]).completionPercent).toBe(100);
  });

  it("exposes rows that are not yet accounted for", () => {
    const batch = ImportBatch.create({
      id: "batch-incomplete-report",
      importerType: "generic_csv",
      sourceFilename: "incomplete.csv",
      sourceSha256: "b".repeat(64),
      rowsTotal: 4,
      status: "previewed",
      rowsImported: 1,
      rowsSkipped: 1,
      rowsFailed: 1,
    });

    expect(buildImportQualityReport([batch]).completionPercent).toBe(75);
  });
});
