import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildLedgerWorkbook } from "./ledgerWorkbookExport";

describe("buildLedgerWorkbook", () => {
  it("crea un workbook XLSX rileggibile", () => {
    const bytes = buildLedgerWorkbook([["Data", "Importo"], ["2026-07-28", "-12345"]]);
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Movimenti!, { header: 1 })).toEqual([["Data", "Importo"], ["2026-07-28", "-12345"]]);
  });
});
