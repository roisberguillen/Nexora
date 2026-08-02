import type { ImportBatch } from "@nexora/domain";

export interface ImportQualityReport {
  readonly batches: number;
  readonly rowsTotal: number;
  readonly rowsImported: number;
  readonly rowsSkipped: number;
  readonly rowsFailed: number;
  readonly completionPercent: number;
}

export function buildImportQualityReport(batches: readonly ImportBatch[]): ImportQualityReport {
  const totals = batches.reduce(
    (report, batch) => ({
      rowsTotal: report.rowsTotal + batch.rowsTotal,
      rowsImported: report.rowsImported + batch.rowsImported,
      rowsSkipped: report.rowsSkipped + batch.rowsSkipped,
      rowsFailed: report.rowsFailed + batch.rowsFailed,
    }),
    { rowsTotal: 0, rowsImported: 0, rowsSkipped: 0, rowsFailed: 0 },
  );
  const accounted = totals.rowsImported + totals.rowsSkipped + totals.rowsFailed;
  return Object.freeze({
    batches: batches.length,
    ...totals,
    completionPercent:
      totals.rowsTotal === 0 ? 100 : Math.round((accounted / totals.rowsTotal) * 100),
  });
}
