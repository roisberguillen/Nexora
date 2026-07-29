import type { TransactionListItem } from "./buildTransactionsViewModel";

export interface TrashSelectionPreview {
  readonly selectedIds: readonly string[];
  readonly transactionGroups: number;
  readonly transfers: number;
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
  readonly accountLabels: readonly string[];
}

/** Builds an explainable preview without mutating the ledger. */
export function previewTrashSelection(
  items: readonly TransactionListItem[],
  selectedIds: ReadonlySet<string>,
): TrashSelectionPreview {
  const selected = items.filter((item) => selectedIds.has(item.id));
  return Object.freeze({
    selectedIds: Object.freeze(selected.map((item) => item.id)),
    transactionGroups: selected.length,
    transfers: selected.filter((item) => item.isTransfer).length,
    incomeMinor: selected
      .filter((item) => !item.isTransfer && item.amount.amountMinor > 0n)
      .reduce((total, item) => total + item.amount.amountMinor, 0n),
    expenseMinor: selected
      .filter((item) => !item.isTransfer && item.amount.amountMinor < 0n)
      .reduce((total, item) => total + item.amount.amountMinor, 0n),
    accountLabels: Object.freeze([...new Set(selected.map((item) => item.accountLabel))].sort()),
  });
}
