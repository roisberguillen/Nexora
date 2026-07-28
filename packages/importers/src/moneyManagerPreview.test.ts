import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  detectMoneyManagerMapping,
  previewMoneyManagerRows,
  readMoneyManagerWorkbook,
} from "./moneyManagerPreview";

describe("Money Manager preview", () => {
  it("legge un workbook e rileva il mapping delle intestazioni italiane", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Data", "Conto", "Importo", "Categoria"],
        ["28/07/2026", "N26", "-12,50", "Spesa"],
      ]),
      "Movimenti",
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const sheet = readMoneyManagerWorkbook(bytes).sheets[0]!;

    expect(sheet.name).toBe("Movimenti");
    expect(detectMoneyManagerMapping(sheet.rows[0]!)).toEqual({
      account: 1,
      amount: 2,
      category: 3,
      date: 0,
    });
  });

  it("normalizza importi localizzati in minor units e segnala righe da revisionare", () => {
    const mapping = { account: 0, amount: 1, date: 2 };
    expect(
      previewMoneyManagerRows(
        [
          ["N26", "1.234,56", "28/07/2026"],
          ["", "errore", "x"],
        ],
        mapping,
      ),
    ).toEqual([
      expect.objectContaining({ amountMinor: 123456n, date: "2026-07-28", status: "ready" }),
      expect.objectContaining({ status: "needs_review" }),
    ]);
  });

  it("rifiuta contenuti che non sono un contenitore XLSX", () => {
    expect(() => readMoneyManagerWorkbook(new TextEncoder().encode("testo").buffer)).toThrow(
      "invalid_xlsx_container",
    );
  });
});
