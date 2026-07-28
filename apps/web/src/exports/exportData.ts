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
  return transactions.filter((transaction) =>
    (filters.accountId === undefined || transaction.accountId === filters.accountId) &&
    (filters.categoryId === undefined || transaction.categoryId === filters.categoryId) &&
    (filters.from === undefined || transaction.bookedDate.toString() >= filters.from) &&
    (filters.to === undefined || transaction.bookedDate.toString() <= filters.to),
  );
}

export function buildTransactionsCsv(data: LedgerExportData): string {
  const accountNames = new Map(data.accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
  const rows = [...data.transactions]
    .sort((left, right) => left.bookedDate.toString().localeCompare(right.bookedDate.toString()) || left.id.localeCompare(right.id))
    .map((transaction) => [
      transaction.id, transaction.bookedDate.toString(), transaction.kind, transaction.status,
      accountNames.get(transaction.accountId) ?? transaction.accountId,
      transaction.amount.amountMinor.toString(), transaction.amount.currency,
      transaction.categoryId === undefined ? "" : (categoryNames.get(transaction.categoryId) ?? transaction.categoryId),
      transaction.payee ?? "", transaction.description ?? "", transaction.source,
    ].map((value, index) => csvCell(value, index !== 5)).join(","));
  return ["id,data,tipo,stato,conto,importo_minor,valuta,categoria,controparte,descrizione,origine", ...rows].join("\r\n");
}

export function buildLedgerJson(data: LedgerExportData): string {
  return JSON.stringify({
    format: "nexora-ledger-export", version: 1,
    accounts: data.accounts.map((account) => ({ ...account, openingBalance: account.openingBalance.toJSON() })),
    categories: data.categories,
    transactions: data.transactions.map((transaction) => ({
      ...transaction, amount: transaction.amount.toJSON(), bookedDate: transaction.bookedDate.toString(),
      valueDate: transaction.valueDate?.toString(),
    })),
  }, null, 2);
}

export function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
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
