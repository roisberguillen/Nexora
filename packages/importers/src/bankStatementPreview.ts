import * as XLSX from "xlsx";

import { readGenericCsv } from "./genericCsvPreview";
import type { MoneyManagerSheet, MoneyManagerWorkbookPreview } from "./moneyManagerPreview";

const canonicalHeaders = ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"] as const;

/** Converts a Mediobanca workbook to the same local, reviewable row shape used by imports. */
export function readMediobancaWorkbook(bytes: ArrayBuffer): MoneyManagerWorkbookPreview {
  const signature = new Uint8Array(bytes.slice(0, 4));
  if (
    signature[0] !== 0x50 ||
    signature[1] !== 0x4b ||
    signature[2] !== 0x03 ||
    signature[3] !== 0x04
  ) {
    throw new Error("invalid_xlsx_container");
  }
  const workbook = XLSX.read(bytes, { type: "array", raw: false, cellDates: false });
  return Object.freeze({
    sheets: Object.freeze(
      workbook.SheetNames.map((name) =>
        normalizeMediobancaSheet(
          name,
          XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name]!, {
            header: 1,
            defval: "",
            raw: false,
          }),
        ),
      ),
    ),
  });
}

/** Identifies the documented Mediobanca Premier CSV layout by its complete header contract. */
export function detectMediobancaPremierCsv(headers: readonly string[]): boolean {
  const normalized = new Set(headers.map(normalize));
  return ["data valuta", "tipologia", "entrate", "uscite", "divisa"].every((header) =>
    normalized.has(header),
  );
}

/** Converts the documented Mediobanca Premier CSV layout into the shared import preview shape. */
export function readMediobancaCsv(bytes: ArrayBuffer): MoneyManagerWorkbookPreview {
  const source = readGenericCsv(bytes);
  const sheet = source.sheets[0];
  if (sheet === undefined || !detectMediobancaPremierCsv(sheet.rows[0] ?? [])) {
    throw new Error("invalid_mediobanca_csv");
  }
  return Object.freeze({
    sheets: Object.freeze([normalizeMediobancaSheet("Mediobanca Premier CSV", sheet.rows)]),
  });
}

/** Extracts text locally from an N26 PDF; unsupported layouts remain review-only. */
export async function readN26Pdf(bytes: ArrayBuffer): Promise<MoneyManagerWorkbookPreview> {
  const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdf.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  const document = await pdf.getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join("\n"));
  }
  return parseN26StatementText(pages.join("\n"));
}

export function parseN26StatementText(text: string): MoneyManagerWorkbookPreview {
  const rows: string[][] = [Array.from(canonicalHeaders)];
  const expression =
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s*\n+([^\n]+)\s*\n+([+-]?\s*[\d.,]+)\s*(EUR|USD|GBP)?/gi;
  for (const match of text.matchAll(expression)) {
    const date = normalizeN26Date(match[1] ?? "");
    const payee = (match[2] ?? "").trim();
    const amount = (match[3] ?? "").replaceAll(" ", "");
    if (date === undefined || payee === "" || amount === "") continue;
    rows.push([date, "N26", amount, (match[4] ?? "EUR").toUpperCase(), payee, "Estratto N26 PDF"]);
  }
  return Object.freeze({
    sheets: Object.freeze([
      Object.freeze({
        name: "N26 PDF",
        rows: Object.freeze(rows.map((row) => Object.freeze(row))),
      }),
    ]),
  });
}

function normalizeMediobancaSheet(
  name: string,
  rows: readonly (readonly unknown[])[],
): MoneyManagerSheet {
  const source = rows.map((row) => row.map((value) => String(value ?? "").trim()));
  const header = source[0]?.map(normalize) ?? [];
  const index = (names: readonly string[]) => header.findIndex((value) => names.includes(value));
  // The accounting date is deliberately never a fallback: the financial date is Data valuta.
  const dateIndex = index(["data valuta"]);
  const debitIndex = index(["addebiti", "addebito", "uscite"]);
  const creditIndex = index(["accrediti", "accredito", "entrate"]);
  const payeeIndex = index(["tipologia", "descrizione", "causale", "beneficiario"]);
  const currencyIndex = index(["divisa", "valuta", "currency"]);
  const normalizedRows = source.slice(1).map((row) => {
    const credit = valueAt(row, creditIndex);
    const debit = valueAt(row, debitIndex);
    const amount =
      credit !== "" && debit !== ""
        ? ""
        : credit !== ""
          ? positiveAmount(credit)
          : debit === ""
            ? ""
            : negativeAmount(debit);
    return [
      valueAt(row, dateIndex),
      "",
      amount,
      valueAt(row, currencyIndex) || "EUR",
      valueAt(row, payeeIndex),
      "Estratto Mediobanca",
    ];
  });
  return Object.freeze({
    name,
    rows: Object.freeze([
      Object.freeze(Array.from(canonicalHeaders)),
      ...normalizedRows.map((row) => Object.freeze(row)),
    ]),
    rawRows: Object.freeze(source.map((row) => Object.freeze([...row]))),
  });
}

function positiveAmount(value: string): string {
  return value.replace(/^\+/, "");
}

function negativeAmount(value: string): string {
  return `-${value.replace(/^[+-]/, "")}`;
}

function valueAt(row: readonly string[], index: number): string {
  return index < 0 ? "" : (row[index] ?? "");
}
function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("it-IT").replaceAll(/\s+/g, " ");
}
function normalizeN26Date(value: string): string | undefined {
  const match = /^(\d{1,2})\s+([a-z]{3,})\s+(\d{4})$/i.exec(value.trim());
  if (match === null) return undefined;
  const month = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].findIndex((item) => match[2]!.toLowerCase().startsWith(item));
  return month < 0
    ? undefined
    : `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}
