import * as XLSX from "xlsx";
import type { Account } from "@nexora/domain";

import { readGenericCsv } from "./genericCsvPreview";
import type { MoneyManagerSheet, MoneyManagerWorkbookPreview } from "./moneyManagerPreview";

const canonicalHeaders = ["Data", "Conto", "Importo", "Valuta", "Controparte", "Nota"] as const;

export interface N26SpaceCandidate {
  readonly name: string;
  readonly movementCount: number;
}

/** A stable, visual text line reconstructed from PDF.js positioned text items. */
export interface PdfTextLine {
  readonly pageNumber: number;
  readonly y: number;
  readonly text: string;
}

export type N26PdfErrorCode = "not_n26_statement" | "n26_statement_parse_failed";

export function resolvePremierBankDefaultAccount(accounts: readonly Account[]): string {
  return (
    accounts.find((account) => !account.isArchived && /mediobanca\s+premier/i.test(account.name))
      ?.name ?? ""
  );
}

export function resolvePdfStatementDefaultAccount(accounts: readonly Account[]): string {
  const candidates = accounts.filter(
    (account) =>
      !account.isArchived &&
      account.type !== "virtual_subaccount" &&
      /\bn26\b/i.test(`${account.name} ${account.institution ?? ""}`),
  );
  return candidates.length === 1 ? candidates[0]!.name : "";
}

export interface PositionedPdfTextItem {
  readonly str: string;
  readonly transform: readonly number[];
  readonly width?: number;
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

/**
 * Extracts an N26 PDF locally. PDF.js exposes positioned fragments, not textual lines, so the
 * parser deliberately receives reconstructed visual rows rather than a newline per fragment.
 */
export async function readN26Pdf(bytes: ArrayBuffer): Promise<MoneyManagerWorkbookPreview> {
  const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const useWorker =
    typeof window !== "undefined" && !window.navigator.userAgent.toLowerCase().includes("jsdom");
  if (useWorker) {
    pdf.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
  }
  const document = await pdf.getDocument({
    data: new Uint8Array(bytes),
    ...(useWorker ? {} : { disableWorker: true }),
  }).promise;
  const lines: PdfTextLine[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    lines.push(
      ...reconstructPdfTextLines(
        pageNumber,
        content.items
          .filter((item) => "str" in item && item.str.trim() !== "")
          .map((item) => item as PositionedPdfTextItem),
      ),
    );
  }
  if (!detectN26Statement(lines)) throw new Error("not_n26_statement" satisfies N26PdfErrorCode);
  const preview = parseN26StatementLines(lines);
  if (preview.sheets[0]?.rows.length === 1) {
    throw new Error("n26_statement_parse_failed" satisfies N26PdfErrorCode);
  }
  return preview;
}

/** Groups PDF fragments by visual baseline, then keeps their left-to-right reading order. */
export function reconstructPdfTextLines(
  pageNumber: number,
  items: readonly PositionedPdfTextItem[],
): readonly PdfTextLine[] {
  const tolerance = 1;
  const groups: { y: number; items: PositionedPdfTextItem[] }[] = [];
  for (const item of items) {
    const y = item.transform[5] ?? 0;
    const group = groups.find((candidate) => Math.abs(candidate.y - y) <= tolerance);
    if (group === undefined) groups.push({ y, items: [item] });
    else group.items.push(item);
  }
  return Object.freeze(
    groups
      .sort((left, right) => right.y - left.y)
      .map((group) => {
        const sorted = [...group.items].sort(
          (left, right) => (left.transform[4] ?? 0) - (right.transform[4] ?? 0),
        );
        let previousEnd: number | undefined;
        const text = sorted
          .map((item) => {
            const x = item.transform[4] ?? 0;
            const gap = previousEnd === undefined ? "" : x > previousEnd + 1 ? " " : "";
            previousEnd = x + (item.width ?? item.str.length);
            return `${gap}${item.str}`;
          })
          .join("")
          .replaceAll(/\s+/g, " ")
          .trim();
        return Object.freeze({ pageNumber, y: group.y, text });
      })
      .filter((line) => line.text !== ""),
  );
}

/** Detects the statement’s structure independently from whether a movement can be parsed. */
export function detectN26Statement(lines: readonly PdfTextLine[] | readonly string[]): boolean {
  const text = lines.map((line) => (typeof line === "string" ? line : line.text)).join("\n");
  const signals = [
    /Estratto conto N\.?/i,
    /Descrizione\s+Data\s+Importo/i,
    /Panoramica/i,
    /Movimenti dello Spazio/i,
    /Spazio:\s*\S/i,
  ];
  return signals.filter((signal) => signal.test(text)).length >= 2;
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
  return parseN26StatementLines(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((text, index) => Object.freeze({ pageNumber: 1, y: -index, text })),
  );
}

/** Parses visual rows one page at a time so a Space label can occur after its movements. */
export function parseN26StatementLines(lines: readonly PdfTextLine[]): MoneyManagerWorkbookPreview {
  const rows: string[][] = [Array.from(canonicalHeaders)];
  const rawRows: string[][] = [Array.from(canonicalHeaders)];
  for (const page of groupN26Pages(lines)) {
    const section = n26SectionForPage(page);
    if (section.kind === "summary" || section.kind === "legal") continue;
    for (let index = 0; index < page.length;) {
      const movement = n26MovementAt(page, index);
      if (movement !== undefined) {
        rows.push([
          movement.date,
          section.spaceName ?? "",
          movement.amount,
          "EUR",
          movement.payee,
          movement.note,
        ]);
        rawRows.push([...movement.raw]);
      }
      index += movement?.consumedLines ?? 1;
    }
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

function groupN26Pages(lines: readonly PdfTextLine[]): readonly (readonly PdfTextLine[])[] {
  const pages = new Map<number, PdfTextLine[]>();
  for (const line of lines) {
    const page = pages.get(line.pageNumber);
    if (page === undefined) pages.set(line.pageNumber, [line]);
    else page.push(line);
  }
  return [...pages.values()].map((page) => Object.freeze([...page]));
}

function n26SectionForPage(lines: readonly PdfTextLine[]): {
  readonly kind: "main" | "space" | "summary" | "legal";
  readonly spaceName?: string;
} {
  const text = lines.map((line) => line.text).join("\n");
  const space = /(?:^|\n)Spazio:\s*(.+?)(?:\n|$)/i.exec(text)?.[1]?.trim();
  const hasMovements =
    /Descrizione\s+Data\s+Importo|Movimenti del conto|Estratto conto N\.?|\d{2}\.\d{2}\.\d{4}\s+[+-][\d.]+,\d{2}/i.test(
      text,
    );
  const hasSummary =
    /Saldo precedente|Operazioni in uscita|Operazioni in entrata|Il tuo nuovo saldo|Panoramica/i.test(
      text,
    );
  if (space !== undefined && space !== "") {
    return hasMovements
      ? { kind: "space", spaceName: space }
      : { kind: "summary", spaceName: space };
  }
  if (hasMovements) return { kind: "main" };
  if (hasSummary) return { kind: "summary" };
  if (/Condizioni|Informazioni legali/i.test(text)) return { kind: "legal" };
  return { kind: "main" };
}

function n26MovementAt(
  page: readonly PdfTextLine[],
  index: number,
):
  | {
      readonly date: string;
      readonly amount: string;
      readonly payee: string;
      readonly note: string;
      readonly consumedLines: number;
      readonly valueDate?: string;
      readonly raw: readonly string[];
    }
  | undefined {
  const line = page[index]?.text ?? "";
  const next = page[index + 1]?.text ?? "";
  if (
    /^(Descrizione|Data|Importo|Valuta|Saldo precedente|Operazioni in (?:uscita|entrata)|Il tuo nuovo saldo|Panoramica|Movimenti dello Spazio|Spazio:|Data di apertura)/i.test(
      line,
    )
  ) {
    return undefined;
  }
  const pattern = /(?:^|\s)(\d{2}\.\d{2}\.\d{4})\s+([+-][\d.]+,\d{2})\s*€?\s*$/u;
  const usesNext = !pattern.test(line);
  const candidate = usesNext ? `${line} ${next}`.trim() : line;
  const match = pattern.exec(candidate);
  if (match === null) return undefined;
  const date = normalizeN26Date(match[1]!);
  const amount = match[2];
  if (date === undefined || amount === undefined) return undefined;
  const description = candidate.slice(0, match.index ?? 0).trim();
  const preceding = page.slice(0, index).map((entry) => entry.text);
  const descriptionLines = preceding
    .slice(-4)
    .filter(
      (entry) =>
        !isN26Metadata(entry) && !/^\d{2}\.\d{2}\.\d{4}$/.test(entry) && !pattern.test(entry),
    );
  const payee = description || (descriptionLines[0] ?? "");
  if (payee === "") return undefined;
  const valueDateLine = page[index - 1]?.text ?? page[index + 2]?.text ?? "";
  const valueDateMatch = /^Valuta\s+(\d{2}\.\d{2}\.\d{4})$/i.exec(valueDateLine);
  const raw = [
    ...descriptionLines,
    valueDateLine,
    line,
    ...(usesNext && next !== "" ? [next] : []),
  ].filter((entry, position, entries) => entry !== "" && entries.indexOf(entry) === position);
  const valueDate = valueDateMatch === null ? undefined : normalizeN26Date(valueDateMatch[1]!);
  return {
    date,
    amount,
    payee,
    note: description ? "" : descriptionLines.slice(1).join(" · "),
    consumedLines: usesNext ? 2 : 1,
    ...(valueDate === undefined ? {} : { valueDate }),
    raw,
  };
}

function isN26Metadata(line: string): boolean {
  return /^(Valuta|Descrizione|Data|Importo|Saldo precedente|Operazioni in (?:uscita|entrata)|Il tuo nuovo saldo|Panoramica|Movimenti dello Spazio|Spazio:|Data di apertura)/i.test(
    line,
  );
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
