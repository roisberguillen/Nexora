import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  detectMediobancaPremierCsv,
  parseN26StatementText,
  readMediobancaCsv,
  readMediobancaWorkbook,
} from "./bankStatementPreview";
import { detectMoneyManagerMapping, previewMoneyManagerRows } from "./moneyManagerPreview";

describe("bank statement previews", () => {
  it("normalizza il CSV Mediobanca Premier su Data valuta, Tipologia, Entrate/Uscite e Divisa", () => {
    const bytes = new TextEncoder().encode(
      "\uFEFFData contabile; Data valuta ;Tipologia;Entrate;Uscite;Divisa\n13/08/2026;11/08/2026;Pagamento POS;;-7,40;EUR\n14/08/2026;12/08/2026;Bonifico;100,00;;EUR",
    ).buffer;
    const preview = readMediobancaCsv(bytes);
    expect(preview.sheets[0]!.rows).toEqual([
      ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"],
      ["11/08/2026", "", "-7,40", "EUR", "Pagamento POS", "Estratto Mediobanca"],
      ["12/08/2026", "", "100,00", "EUR", "Bonifico", "Estratto Mediobanca"],
    ]);
    expect(preview.sheets[0]!.rawRows?.[1]).toEqual([
      "13/08/2026",
      "11/08/2026",
      "Pagamento POS",
      "",
      "-7,40",
      "EUR",
    ]);
    const rows = previewMoneyManagerRows(
      preview.sheets[0]!.rows.slice(1),
      detectMoneyManagerMapping(preview.sheets[0]!.rows[0]!),
      1,
      preview.sheets[0]!.rawRows?.slice(1),
    );
    expect(rows.map((row) => [row.date, row.amountMinor, row.payee, row.currency])).toEqual([
      ["2026-08-11", -740n, "Pagamento POS", "EUR"],
      ["2026-08-12", 10000n, "Bonifico", "EUR"],
    ]);
  });

  it("riconosce soltanto il contratto di intestazioni Mediobanca, non un CSV generico", () => {
    expect(
      detectMediobancaPremierCsv(["Data valuta", "Entrate", "Uscite", "Divisa", "Tipologia"]),
    ).toBe(true);
    expect(detectMediobancaPremierCsv(["Data", "Conto", "Importo", "Valuta"])).toBe(false);
  });

  it("lascia Data valuta mancante e importi ambigui da revisionare senza fallback", () => {
    const bytes = new TextEncoder().encode(
      "Data contabile;Data valuta;Tipologia;Entrate;Uscite;Divisa\n13/08/2026;;Pagamento POS;;-7,40;EUR\n13/08/2026;11/08/2026;Operazione;10,00;-7,40;EUR",
    ).buffer;
    const workbook = readMediobancaCsv(bytes);
    const rows = previewMoneyManagerRows(
      workbook.sheets[0]!.rows.slice(1),
      detectMoneyManagerMapping(workbook.sheets[0]!.rows[0]!),
    );
    expect(rows.map((row) => [row.date, row.amountMinor, row.status])).toEqual([
      [undefined, -740n, "needs_review"],
      ["2026-08-11", undefined, "needs_review"],
    ]);
  });

  it("normalizza il workbook Mediobanca usando Data valuta e senza doppio negativo", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Data contabile", "Data valuta", "Tipologia", "Uscite", "Entrate", "Divisa"],
        ["28/07/2026", "29/07/2026", "Bonifico entrante", "", "1.234,56", "EUR"],
        ["29/07/2026", "30/07/2026", "Carta", "-12,50", "", "EUR"],
      ]),
      "Estratto",
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    expect(readMediobancaWorkbook(bytes).sheets[0]!.rows).toEqual([
      ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"],
      ["29/07/2026", "", "1.234,56", "EUR", "Bonifico entrante", "Estratto Mediobanca"],
      ["30/07/2026", "", "-12,50", "EUR", "Carta", "Estratto Mediobanca"],
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
