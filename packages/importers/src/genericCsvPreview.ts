import type { MoneyManagerWorkbookPreview } from "./moneyManagerPreview";

const MAX_CSV_BYTES = 10 * 1024 * 1024;
const MAX_CSV_ROWS = 100_000;
const MAX_CSV_COLUMNS = 256;

export function readGenericCsv(bytes: ArrayBuffer): MoneyManagerWorkbookPreview {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CSV_BYTES) throw new Error("invalid_csv");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("invalid_csv_encoding");
  }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  if (rows.length === 0 || rows.every((row) => row.every((cell) => cell.trim() === ""))) {
    throw new Error("empty_csv");
  }
  return Object.freeze({
    sheets: Object.freeze([
      Object.freeze({
        name: "CSV",
        rows: Object.freeze(rows.map((row) => Object.freeze(row))),
      }),
    ]),
  });
}

function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstRecord = firstLogicalRecord(text);
  const candidates = [",", ";", "\t"] as const;
  const ranked = candidates
    .map((delimiter) => ({ delimiter, count: countOutsideQuotes(firstRecord, delimiter) }))
    .sort((a, b) => b.count - a.count);
  if (ranked[0]!.count === 0) throw new Error("csv_delimiter_not_found");
  return ranked[0]!.delimiter;
}

function firstLogicalRecord(text: string): string {
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === "\n" || character === "\r")) {
      return text.slice(0, index);
    }
  }
  return text;
}

function countOutsideQuotes(record: string, delimiter: string): number {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index]!;
    if (character === '"') {
      if (quoted && record[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) count += 1;
  }
  return count;
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += character;
      continue;
    }
    if (character === '"' && cell === "") quoted = true;
    else if (character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.length > MAX_CSV_COLUMNS) throw new Error("csv_too_many_columns");
      rows.push(row);
      if (rows.length > MAX_CSV_ROWS) throw new Error("csv_too_many_rows");
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("invalid_csv_quotes");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.length > MAX_CSV_COLUMNS) throw new Error("csv_too_many_columns");
    rows.push(row);
  }
  return rows;
}
