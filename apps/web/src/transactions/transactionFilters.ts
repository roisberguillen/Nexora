import type { TransactionListItem } from "./buildTransactionsViewModel";

export interface TransactionFilters {
  readonly accountLabel: string;
  readonly categoryLabel: string;
  readonly kindLabel: string;
  readonly month: string;
  readonly query: string;
  readonly statusLabel: string;
}

export const emptyTransactionFilters: TransactionFilters = Object.freeze({
  accountLabel: "",
  categoryLabel: "",
  kindLabel: "",
  month: "",
  query: "",
  statusLabel: "",
});

export function filterTransactions(
  items: readonly TransactionListItem[],
  filters: TransactionFilters,
): readonly TransactionListItem[] {
  const query = filters.query.trim().toLocaleLowerCase("it-IT");
  return items.filter((item) => {
    if (filters.accountLabel !== "" && item.accountLabel !== filters.accountLabel) return false;
    if (filters.categoryLabel !== "" && item.categoryLabel !== filters.categoryLabel) return false;
    if (filters.kindLabel !== "" && item.kindLabel !== filters.kindLabel) return false;
    if (filters.statusLabel !== "" && item.statusLabel !== filters.statusLabel) return false;
    if (filters.month !== "" && !item.bookedDate.startsWith(filters.month)) return false;
    return (
      query === "" ||
      [
        item.title,
        item.description ?? "",
        item.payee ?? "",
        item.accountLabel,
        item.categoryLabel,
        item.kindLabel,
        item.statusLabel,
        item.amount.amountMinor.toString(),
      ].some((value) => value.toLocaleLowerCase("it-IT").includes(query))
    );
  });
}

export function hasTransactionFilters(filters: TransactionFilters): boolean {
  return Object.values(filters).some((value) => value !== "");
}
