import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  detectMediobancaPremierCsv,
  extractN26SpaceCandidates,
  parseN26StatementText,
  parseN26ItalianStatementText,
  parseN26StatementLines,
  readMediobancaCsv,
  readMediobancaWorkbook,
  reconstructPdfTextLines,
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
      ["2026-07-28", "", "-4,50", "EUR", "Coffee shop", "Estratto N26 PDF"],
    ]);
  });

  it("normalizza il layout N26 italiano, importi in migliaia e descrizioni su più righe", () => {
    const preview = parseN26ItalianStatementText(
      [
        "Pagamento carta",
        "Mastercard • Bar e ristoranti",
        "Valuta 11.06.2026",
        "11.06.2026 -40,00€",
        "Bonifico ricevuto",
        "Valuta 12.06.2026",
        "12.06.2026 +3.000,00€",
        "Saldo precedente",
        "100,00€",
        "Il tuo nuovo saldo",
      ].join("\n"),
    );
    expect(preview.sheets[0]!.rows).toEqual([
      ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"],
      [
        "2026-06-11",
        "",
        "-40,00",
        "EUR",
        "Pagamento carta",
        "Mastercard • Bar e ristoranti",
      ],
      ["2026-06-12", "", "+3.000,00", "EUR", "Bonifico ricevuto", ""],
    ]);
    expect(preview.sheets[0]!.rawRows?.[1]).toEqual([
      "Pagamento carta",
      "Mastercard • Bar e ristoranti",
      "Valuta 11.06.2026",
      "11.06.2026 -40,00€",
    ]);
  });

  it("rileva gli Spaces dichiarati anche senza movimenti e normalizza solo per il confronto", () => {
    expect(
      extractN26SpaceCandidates("Spazio: Riserva\nMovimenti dello Spazio\nSpazio:   Salute  \nSpazio: riserva"),
    ).toEqual([
      { name: "Riserva", movementCount: 0 },
      { name: "Salute", movementCount: 0 },
    ]);
  });

  it("associa i movimenti della sezione Space allo Space esplicito", () => {
    const preview = parseN26ItalianStatementText(
      "Spazio: Riserva\nDa Conto corrente principale\nValuta 11.06.2026\n11.06.2026 +40,00€",
    );
    expect(preview.sheets[0]!.rows[1]).toEqual([
      "2026-06-11",
      "Riserva",
      "+40,00",
      "EUR",
      "Da Conto corrente principale",
      "",
    ]);
  });

  it("ricostruisce una riga N26 da TextItem PDF separati per colonna", () => {
    const lines = reconstructPdfTextLines(1, [
      { str: "A Luce/gas", transform: [1, 0, 0, 1, 100, 500], width: 80 },
      { str: "11.06.2026", transform: [1, 0, 0, 1, 400, 500], width: 60 },
      { str: "-40,00€", transform: [1, 0, 0, 1, 500, 500], width: 45 },
      { str: "Valuta", transform: [1, 0, 0, 1, 100, 480], width: 35 },
      { str: "11.06.2026", transform: [1, 0, 0, 1, 145, 480], width: 60 },
    ]);
    expect(lines.map((line) => line.text)).toEqual([
      "A Luce/gas 11.06.2026 -40,00€",
      "Valuta 11.06.2026",
    ]);
    expect(parseN26StatementLines(lines).sheets[0]!.rows[1]).toEqual([
      "2026-06-11",
      "",
      "-40,00",
      "EUR",
      "A Luce/gas",
      "",
    ]);
  });

  it("assegna lo Space della pagina anche quando la sua label segue i movimenti", () => {
    const lines = [
      { pageNumber: 1, y: 500, text: "Da Conto corrente principale 11.06.2026 +40,00€" },
      { pageNumber: 1, y: 480, text: "Valuta 11.06.2026" },
      { pageNumber: 1, y: 100, text: "Movimenti dello Spazio N. 06/2026" },
      { pageNumber: 1, y: 80, text: "Spazio: Liquidità" },
      { pageNumber: 2, y: 500, text: "Spazio: Riserva" },
    ] as const;
    const preview = parseN26StatementLines(lines);
    expect(preview.sheets[0]!.rows[1]?.[1]).toBe("Liquidità");
    expect(extractN26SpaceCandidates(lines.map((line) => line.text).join("\n"))).toEqual([
      { name: "Liquidità", movementCount: 0 },
      { name: "Riserva", movementCount: 0 },
    ]);
  });

  it("does not classify a movement page as legal merely because its header contains IBAN and BIC", () => {
    const preview = parseN26StatementLines([
      { pageNumber: 1, y: 500, text: "IBAN BIC Estratto conto N. 06/2026" },
      { pageNumber: 1, y: 480, text: "Descrizione Data Importo" },
      { pageNumber: 1, y: 460, text: "Pagamento 11.06.2026 -40,00€" },
    ]);
    expect(preview.sheets[0]!.rows).toHaveLength(2);
  });

  it("consumes an amount line already used with its preceding date", () => {
    const preview = parseN26StatementLines([
      { pageNumber: 1, y: 500, text: "Pagamento" },
      { pageNumber: 1, y: 480, text: "11.06.2026" },
      { pageNumber: 1, y: 460, text: "-40,00€" },
      { pageNumber: 1, y: 440, text: "Valuta 11.06.2026" },
    ]);
    expect(preview.sheets[0]!.rows).toHaveLength(2);
  });
});
