import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseN26StatementText, readMediobancaWorkbook } from "./bankStatementPreview";

describe("bank statement previews", () => {
  it("normalizza le colonne Mediobanca accrediti/addebiti senza perdere il segno", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Data operazione", "Descrizione", "Addebiti", "Accrediti", "Valuta"],
        ["28/07/2026", "Bonifico entrante", "", "1.234,56", "EUR"],
        ["29/07/2026", "Carta", "12,50", "", "EUR"],
      ]),
      "Estratto",
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    expect(readMediobancaWorkbook(bytes).sheets[0]!.rows).toEqual([
      ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"],
      [
        "28/07/2026",
        "Mediobanca",
        "1.234,56",
        "EUR",
        "Bonifico entrante",
        "Estratto Mediobanca XLSX",
      ],
      ["29/07/2026", "Mediobanca", "-12,50", "EUR", "Carta", "Estratto Mediobanca XLSX"],
    ]);
  });

  it("estrae solo le righe riconoscibili dal testo N26 e lascia le altre fuori dal commit", () => {
    const preview = parseN26StatementText(
      "28 Jul 2026\nCoffee shop\n-4,50 EUR\nRiga non riconosciuta",
    );
    expect(preview.sheets[0]!.rows).toEqual([
      ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"],
      ["2026-07-28", "N26", "-4,50", "EUR", "Coffee shop", "Estratto N26 PDF"],
    ]);
  });
});
