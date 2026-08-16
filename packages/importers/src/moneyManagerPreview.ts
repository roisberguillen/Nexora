import * as XLSX from "xlsx";

export type MoneyManagerField =
  | "account"
  | "amount"
  | "category"
  | "subcategory"
  | "currency"
  | "date"
  | "note"
  | "payee"
  | "type";

export interface MoneyManagerSheet {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
  /** Original cells, when a source-specific normalizer produces canonical rows. */
  readonly rawRows?: readonly (readonly string[])[];
}

export interface MoneyManagerWorkbookPreview {
  readonly sheets: readonly MoneyManagerSheet[];
}

export interface MoneyManagerMapping {
  readonly account?: number;
  readonly amount?: number;
  readonly category?: number;
  readonly subcategory?: number;
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
  /** Immutable source cells, retained verbatim for the import audit trail. */
  readonly rawValues?: readonly string[];
  readonly sourceRowNumber: number;
  readonly sourceCategory?: string;
  readonly sourceSubcategory?: string;
  readonly note?: string;
  readonly status: ImportPreviewStatus;
  readonly sourceType?: string;
}

const aliases: Readonly<Record<MoneyManagerField, readonly string[]>> = {
  account: ["account", "conto"],
  amount: ["amount", "importo", "value"],
  category: ["category", "categoria"],
  subcategory: ["subcategory", "sotto-categoria"],
  currency: ["currency", "valuta"],
  date: ["date", "data", "giorno", "transaction date"],
  note: ["note", "nota", "description", "descrizione"],
  payee: ["payee", "controparte", "beneficiary"],
  type: ["type", "tipo", "guadagni/spese"],
};

const moneyManagerCanonicalHeaders = [
  "Data",
  "Conto",
  "Importo",
  "Valuta",
  "Controparte",
  "Nota",
  "Categoria",
  "Sotto-categoria",
  "Tipo",
] as const;

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
      workbook.SheetNames.map((name) => {
        const rows = XLSX.utils
          .sheet_to_json<unknown[]>(workbook.Sheets[name]!, { header: 1, defval: "", raw: true })
          .map((row) => row.map((cell) => String(cell ?? "").trim()));
        return detectMoneyManagerWorkbook(rows[0] ?? [])
          ? normalizeMoneyManagerWorkbook(name, rows)
          : Object.freeze({ name, rows: Object.freeze(rows.map((row) => Object.freeze(row))) });
      }),
    ),
  });
}

/** Identifies Money Manager exports by their complete, non-ambiguous header contract. */
export function detectMoneyManagerWorkbook(headers: readonly string[]): boolean {
  const values = headers.map(normalizeHeader);
  return ["giorno", "conto", "categoria", "nota", "guadagni/spese", "importo", "valuta"].every(
    (header) => values.includes(header),
  );
}

/** Normalizes Money Manager’s absolute amount plus source-type contract before the generic preview. */
export function normalizeMoneyManagerWorkbook(
  name: string,
  source: readonly (readonly string[])[],
): MoneyManagerSheet {
  const header = source[0]?.map(normalizeHeader) ?? [];
  const indexOf = (headerName: string) => header.indexOf(headerName);
  const day = indexOf("giorno");
  const account = indexOf("conto");
  const category = indexOf("categoria");
  const subcategory = indexOf("sotto-categoria");
  const note = indexOf("nota");
  const type = indexOf("guadagni/spese");
  const amount = indexOf("importo");
  const currency = indexOf("valuta");
  const value = (row: readonly string[], index: number) =>
    index < 0 ? "" : (row[index] ?? "").trim();
  const normalized = source.slice(1).map((row) => {
    const sourceType = value(row, type);
    const absoluteAmount = value(row, amount);
    const signedAmount =
      /^spesa$/i.test(sourceType) || /^trasferimento uscita$/i.test(sourceType)
        ? `-${absoluteAmount.replace(/^[+-]/, "")}`
        : absoluteAmount.replace(/^[+]/, "");
    const sourceCategory = [value(row, category), value(row, subcategory)]
      .filter(Boolean)
      .join(" / ");
    return [
      value(row, day),
      value(row, account),
      signedAmount,
      value(row, currency) || "EUR",
      value(row, note),
      value(row, note),
      value(row, category),
      value(row, subcategory),
      sourceType,
    ];
  });
  return Object.freeze({
    name,
    rows: Object.freeze([
      Object.freeze([...moneyManagerCanonicalHeaders]),
      ...normalized.map((row) => Object.freeze(row)),
    ]),
    rawRows: Object.freeze(source.map((row) => Object.freeze([...row]))),
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
  rawRows?: readonly (readonly string[])[],
): readonly MoneyManagerPreviewRow[] {
  return rows.map((row, index) =>
    previewRow(row, mapping, headerRowNumber + index + 1, rawRows?.[index]),
  );
}

function previewRow(
  row: readonly string[],
  mapping: MoneyManagerMapping,
  sourceRowNumber: number,
  sourceRawValues: readonly string[] | undefined,
): MoneyManagerPreviewRow {
  const rawValues = Object.freeze([...(sourceRawValues ?? row)]);
  const dateText = field(row, mapping.date);
  const amountText = field(row, mapping.amount);
  const date = dateText === undefined ? undefined : normalizeDate(dateText);
  const amountMinor = amountText === undefined ? undefined : parseLocalizedMinor(amountText);
  const account = field(row, mapping.account);
  const currency = field(row, mapping.currency)?.toUpperCase() ?? "EUR";
  const sourceType = field(row, mapping.type);
  const note = field(row, mapping.note);
  const sourceCategory = field(row, mapping.category);
  const sourceSubcategory = field(row, mapping.subcategory);
  if (date === undefined || amountMinor === undefined) {
    return Object.freeze({
      account,
      amountMinor,
      category: field(row, mapping.category),
      currency,
      date,
      message: "Data o importo non interpretabile: richiede revisione.",
      payee: field(row, mapping.payee),
      rawValues,
      sourceRowNumber,
      status: "needs_review",
      ...(sourceType === undefined ? {} : { sourceType }),
      ...(note === undefined ? {} : { note }),
      ...(sourceCategory === undefined ? {} : { sourceCategory }),
      ...(sourceSubcategory === undefined ? {} : { sourceSubcategory }),
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
      rawValues,
      sourceRowNumber,
      status: "needs_review",
      ...(sourceType === undefined ? {} : { sourceType }),
      ...(note === undefined ? {} : { note }),
      ...(sourceCategory === undefined ? {} : { sourceCategory }),
      ...(sourceSubcategory === undefined ? {} : { sourceSubcategory }),
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
    rawValues,
    sourceRowNumber,
    status: "ready",
    ...(sourceType === undefined ? {} : { sourceType }),
    ...(note === undefined ? {} : { note }),
    ...(sourceCategory === undefined ? {} : { sourceCategory }),
    ...(sourceSubcategory === undefined ? {} : { sourceSubcategory }),
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
  const excelSerial = normalizeExcelSerialDate(value);
  if (excelSerial !== undefined) return excelSerial;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso !== null) return isCalendarDate(value) ? value : undefined;
  const italian = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(value);
  if (italian === null) return undefined;
  const day = italian[1]!.padStart(2, "0");
  const month = italian[2]!.padStart(2, "0");
  const result = `${italian[3]}-${month}-${day}`;
  return isCalendarDate(result) ? result : undefined;
}

function normalizeExcelSerialDate(value: string): string | undefined {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
  const serial = Math.floor(Number(value));
  if (!Number.isSafeInteger(serial) || serial < 1 || serial > 2_958_465 || serial === 60) {
    return undefined;
  }
  const adjustedDays = serial > 60 ? serial - 1 : serial;
  const date = new Date(Date.UTC(1899, 11, 31) + adjustedDays * 86_400_000);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const result = `${year}-${month}-${day}`;
  return isCalendarDate(result) ? result : undefined;
}

function parseLocalizedMinor(value: string): bigint | undefined {
  const normalized = value.trim().replaceAll(" ", "").replaceAll("€", "");
  if (!/^[+-]?[\d.,]+$/.test(normalized)) return undefined;
  const negative = normalized.startsWith("-");
  const unsigned =
    normalized.startsWith("-") || normalized.startsWith("+") ? normalized.slice(1) : normalized;
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
