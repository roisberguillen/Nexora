import * as XLSX from "xlsx";

import { readGenericCsv } from "./genericCsvPreview";
import type { MoneyManagerSheet, MoneyManagerWorkbookPreview } from "./moneyManagerPreview";

const canonicalHeaders = ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"] as const;

export interface N26SpaceCandidate {
  readonly name: string;
  readonly movementCount: number;
}

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
  const preview = parseN26StatementText(pages.join("\n"));
  if (preview.sheets[0]?.rows.length === 1) throw new Error("unsupported_n26_pdf");
  return preview;
}

export function parseN26StatementText(text: string): MoneyManagerWorkbookPreview {
  const italian = parseN26ItalianStatementText(text);
  if (italian.sheets[0]?.rows.length !== 1) return italian;
  const rows: string[][] = [Array.from(canonicalHeaders)];
  const expression =
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s*\n+([^\n]+)\s*\n+([+-]?\s*[\d.,]+)\s*(EUR|USD|GBP)?/gi;
  for (const match of text.matchAll(expression)) {
    const date = normalizeN26Date(match[1] ?? "");
    const payee = (match[2] ?? "").trim();
    const amount = (match[3] ?? "").replaceAll(" ", "");
    if (date === undefined || payee === "" || amount === "") continue;
    rows.push([date, "", amount, (match[4] ?? "EUR").toUpperCase(), payee, "Estratto N26 PDF"]);
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

/**
 * Parses the documented Italian N26 statement sequence without treating balances or summaries
 * as movements. The original source lines remain attached to the preview for the import audit.
 */
export function parseN26ItalianStatementText(text: string): MoneyManagerWorkbookPreview {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const rows: string[][] = [Array.from(canonicalHeaders)];
  const rawRows: string[][] = [Array.from(canonicalHeaders)];
  const amountLine = /^(\d{2}\.\d{2}\.\d{4})\s+([+-][\d.]+,\d{2})\s*€$/;
  for (let index = 0; index < lines.length; index += 1) {
    const match = amountLine.exec(lines[index]!);
    if (match === null) continue;
    const valueDateIndex = index - 1;
    if (!/^Valuta\s+\d{2}\.\d{2}\.\d{4}$/i.test(lines[valueDateIndex] ?? "")) continue;
    const description = n26Description(lines, valueDateIndex);
    if (description === undefined) continue;
    const date = normalizeN26Date(match[1]!);
    if (date === undefined) continue;
    rows.push([
      date,
      n26SpaceAt(lines, index) ?? "",
      match[2]!,
      "EUR",
      description.payee,
      description.note,
    ]);
    rawRows.push([...lines.slice(description.start, index + 1)]);
  }
  return Object.freeze({
    sheets: Object.freeze([
      Object.freeze({
        name: "N26 PDF",
        rows: Object.freeze(rows.map((row) => Object.freeze(row))),
        rawRows: Object.freeze(rawRows.map((row) => Object.freeze(row))),
      }),
    ]),
  });
}

function n26SpaceAt(lines: readonly string[], index: number): string | undefined {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const match = /^\s*Spazio:\s*(.+?)\s*$/i.exec(lines[cursor]!);
    if (match !== null) return match[1]!.trim();
    if (/^Movimenti del conto|^Estratto conto/i.test(lines[cursor]!)) return undefined;
  }
  return undefined;
}

/** Finds declared Spaces independently of their movement count. */
export function extractN26SpaceCandidates(text: string): readonly N26SpaceCandidate[] {
  const names = text
    .split(/\r?\n/)
    .map((line) => /^\s*Spazio:\s*(.+?)\s*$/i.exec(line)?.[1]?.trim())
    .filter((name): name is string => name !== undefined && name !== "");
  const unique = new Map<string, N26SpaceCandidate>();
  for (const name of names) {
    const key = name.toLocaleLowerCase("it-IT").replaceAll(/\s+/g, " ");
    if (!unique.has(key)) unique.set(key, Object.freeze({ name, movementCount: 0 }));
  }
  return Object.freeze([...unique.values()]);
}

function n26Description(
  lines: readonly string[],
  valueDateIndex: number,
): { readonly payee: string; readonly note: string; readonly start: number } | undefined {
  const source: string[] = [];
  let start = valueDateIndex;
  for (let index = valueDateIndex - 1; index >= 0 && source.length < 4; index -= 1) {
    const line = lines[index]!;
    if (
      /^(Descrizione|Data|Importo|Saldo precedente|Operazioni in (?:uscita|entrata)|Il tuo nuovo saldo|Panoramica|Movimenti dello Spazio|Spazio:)/i.test(
        line,
      )
    )
      break;
    if (/^\d{2}\.\d{2}\.\d{4}\s+[+-]/.test(line)) break;
    source.unshift(line);
    start = index;
  }
  const payee = source[0]?.trim();
  return payee === undefined || payee === ""
    ? undefined
    : { payee, note: source.slice(1).join(" · "), start };
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
  const italian = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (italian !== null) return `${italian[3]}-${italian[2]}-${italian[1]}`;
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
