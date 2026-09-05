import type { Account, Category, Transaction } from "@nexora/domain";

export interface LedgerExportData {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
}

export interface ExportFilters {
  readonly accountId?: string;
  readonly categoryId?: string;
  readonly from?: string;
  readonly to?: string;
}

export function filterExportTransactions(
  transactions: readonly Transaction[],
  filters: ExportFilters,
): readonly Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.status !== "cancelled" &&
      (filters.accountId === undefined || transaction.accountId === filters.accountId) &&
      (filters.categoryId === undefined || transaction.categoryId === filters.categoryId) &&
      (filters.from === undefined || transaction.bookedDate.toString() >= filters.from) &&
      (filters.to === undefined || transaction.bookedDate.toString() <= filters.to),
  );
}

export function buildTransactionsCsv(data: LedgerExportData): string {
  return buildTransactionsRows(data)
    .map((row, index) =>
      index === 0
        ? row.join(",")
        : row.map((value, cellIndex) => csvCell(value, cellIndex !== 5)).join(","),
    )
    .join("\r\n");
}

export function buildTransactionsRows(data: LedgerExportData): readonly (readonly string[])[] {
  const accountNames = new Map(data.accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
  const rows = [...data.transactions]
    .sort(
      (left, right) =>
        left.bookedDate.toString().localeCompare(right.bookedDate.toString()) ||
        left.id.localeCompare(right.id),
    )
    .map((transaction) => [
      transaction.id,
      transaction.bookedDate.toString(),
      transaction.kind,
      transaction.status,
      accountNames.get(transaction.accountId) ?? transaction.accountId,
      transaction.amount.amountMinor.toString(),
      transaction.amount.currency,
      transaction.categoryId === undefined
        ? ""
        : (categoryNames.get(transaction.categoryId) ?? transaction.categoryId),
      transaction.payee ?? "",
      transaction.description ?? "",
      transaction.source,
      transaction.expenseVariability ?? "",
      transaction.expenseExceptionality ?? "",
    ]);
  return [
    [
      "id",
      "data",
      "tipo",
      "stato",
      "conto",
      "importo_minor",
      "valuta",
      "categoria",
      "controparte",
      "descrizione",
      "origine",
      "variabilita_spesa",
      "eccezionalita_spesa",
    ],
    ...rows,
  ];
}

export function buildLedgerJson(data: LedgerExportData): string {
  return JSON.stringify(
    {
      format: "nexora-ledger-export",
      version: 1,
      accounts: data.accounts.map((account) => ({
        ...account,
        openingBalance: account.openingBalance.toJSON(),
      })),
      categories: data.categories,
      transactions: data.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toJSON(),
        bookedDate: transaction.bookedDate.toString(),
        valueDate: transaction.valueDate?.toString(),
      })),
    },
    null,
    2,
  );
}

export function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(
  filename: string,
  content: ArrayBuffer | Uint8Array,
  type: string,
): void {
  const bytes = content instanceof Uint8Array ? Uint8Array.from(content).buffer : content;
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string, protectFormula: boolean): string {
  const safe = protectFormula && /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
