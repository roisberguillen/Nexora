import * as XLSX from "xlsx";

export function buildLedgerWorkbook(rows: readonly (readonly string[])[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => [...row]));
  XLSX.utils.book_append_sheet(workbook, sheet, "Movimenti");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
