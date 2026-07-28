import * as XLSX from "xlsx";

export type MoneyManagerField =
  "account" | "amount" | "category" | "currency" | "date" | "note" | "payee" | "type";

export interface MoneyManagerSheet {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
}

export interface MoneyManagerWorkbookPreview {
  readonly sheets: readonly MoneyManagerSheet[];
}

export interface MoneyManagerMapping {
  readonly account?: number;
  readonly amount?: number;
  readonly category?: number;
  readonly currency?: number;
  readonly date?: number;
  readonly note?: number;
  readonly payee?: number;
  readonly type?: number;
}

export type ImportPreviewStatus = "failed" | "needs_review" | "ready";

export interface MoneyManagerPreviewRow {
  readonly account: string | undefined;
  readonly amountMinor: bigint | undefined;
  readonly category: string | undefined;
  readonly currency: string | undefined;
  readonly date: string | undefined;
  readonly message: string;
  readonly payee: string | undefined;
  readonly sourceRowNumber: number;
  readonly status: ImportPreviewStatus;
}

const aliases: Readonly<Record<MoneyManagerField, readonly string[]>> = {
  account: ["account", "conto"],
  amount: ["amount", "importo", "value"],
  category: ["category", "categoria"],
  currency: ["currency", "valuta"],
  date: ["date", "data", "transaction date"],
  note: ["note", "nota", "description", "descrizione"],
  payee: ["payee", "controparte", "beneficiary"],
  type: ["type", "tipo"],
};

export function readMoneyManagerWorkbook(bytes: ArrayBuffer): MoneyManagerWorkbookPreview {
  const signature = new Uint8Array(bytes.slice(0, 4));
  if (
    signature.length !== 4 ||
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
        Object.freeze({
          name,
          rows: Object.freeze(
            XLSX.utils
              .sheet_to_json<unknown[]>(workbook.Sheets[name]!, {
                header: 1,
                defval: "",
                raw: false,
              })
              .map((row) => Object.freeze(row.map((cell) => String(cell ?? "").trim()))),
          ),
        }),
      ),
    ),
  });
}

export function detectMoneyManagerMapping(headers: readonly string[]): MoneyManagerMapping {
  const normalized = headers.map(normalizeHeader);
  return Object.freeze(
    Object.fromEntries(
      (Object.keys(aliases) as MoneyManagerField[])
        .map((field) => [field, normalized.findIndex((header) => aliases[field].includes(header))])
        .filter(([, index]) => index !== -1),
    ) as MoneyManagerMapping,
  );
}

export function previewMoneyManagerRows(
  rows: readonly (readonly string[])[],
  mapping: MoneyManagerMapping,
  headerRowNumber = 1,
): readonly MoneyManagerPreviewRow[] {
  return rows.map((row, index) => previewRow(row, mapping, headerRowNumber + index + 1));
}

function previewRow(
  row: readonly string[],
  mapping: MoneyManagerMapping,
  sourceRowNumber: number,
): MoneyManagerPreviewRow {
  const dateText = field(row, mapping.date);
  const amountText = field(row, mapping.amount);
  const date = dateText === undefined ? undefined : normalizeDate(dateText);
  const amountMinor = amountText === undefined ? undefined : parseLocalizedMinor(amountText);
  const account = field(row, mapping.account);
  const currency = field(row, mapping.currency)?.toUpperCase() ?? "EUR";
  if (date === undefined || amountMinor === undefined) {
    return Object.freeze({
      account,
      amountMinor,
      category: field(row, mapping.category),
      currency,
      date,
      message: "Data o importo non interpretabile: richiede revisione.",
      payee: field(row, mapping.payee),
      sourceRowNumber,
      status: "needs_review",
    });
  }
  if (account === undefined) {
    return Object.freeze({
      account,
      amountMinor,
      category: field(row, mapping.category),
      currency,
      date,
      message: "Conto assente: richiede risoluzione prima dell'importazione.",
      payee: field(row, mapping.payee),
      sourceRowNumber,
      status: "needs_review",
    });
  }
  return Object.freeze({
    account,
    amountMinor,
    category: field(row, mapping.category),
    currency,
    date,
    message: "Riga pronta per il dry-run.",
    payee: field(row, mapping.payee),
    sourceRowNumber,
    status: "ready",
  });
}

function field(row: readonly string[], index: number | undefined): string | undefined {
  const value = index === undefined ? undefined : row[index]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase("it-IT").replaceAll(/\s+/g, " ");
}

function normalizeDate(value: string): string | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso !== null) return isCalendarDate(value) ? value : undefined;
  const italian = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(value);
  if (italian === null) return undefined;
  const day = italian[1]!.padStart(2, "0");
  const month = italian[2]!.padStart(2, "0");
  const result = `${italian[3]}-${month}-${day}`;
  return isCalendarDate(result) ? result : undefined;
}

function parseLocalizedMinor(value: string): bigint | undefined {
  const normalized = value.trim().replaceAll(" ", "").replaceAll("€", "");
  if (!/^-?[\d.,]+$/.test(normalized)) return undefined;
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const decimalSeparator = findDecimalSeparator(unsigned);
  const separatorIndex =
    decimalSeparator === undefined ? -1 : unsigned.lastIndexOf(decimalSeparator);
  const integerRaw = separatorIndex === -1 ? unsigned : unsigned.slice(0, separatorIndex);
  const fractionRaw = separatorIndex === -1 ? "" : unsigned.slice(separatorIndex + 1);
  if (fractionRaw.length > 2 || integerRaw === "") return undefined;
  const integer = integerRaw.replaceAll(/[.,]/g, "");
  if (!/^\d+$/.test(integer) || !/^\d*$/.test(fractionRaw)) return undefined;
  const minor = BigInt(integer) * 100n + BigInt(fractionRaw.padEnd(2, "0") || "0");
  return negative ? -minor : minor;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function findDecimalSeparator(value: string): "." | "," | undefined {
  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma !== -1 && dot !== -1) return comma > dot ? "," : ".";
  const separator = comma !== -1 ? "," : dot !== -1 ? "." : undefined;
  if (separator === undefined) return undefined;
  const fractionLength = value.length - value.lastIndexOf(separator) - 1;
  return fractionLength >= 1 && fractionLength <= 2 ? separator : undefined;
}
