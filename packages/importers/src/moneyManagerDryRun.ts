import type { Account, Category, Transaction, TransactionKind } from "@nexora/domain";

import type { MoneyManagerPreviewRow } from "./moneyManagerPreview";

export type DryRunStatus = "needs_review" | "ready" | "skipped_duplicate";

export interface MoneyManagerDryRunRow {
  readonly accountId: string | undefined;
  readonly categoryId: string | undefined;
  readonly kind: Exclude<TransactionKind, "adjustment" | "transfer"> | undefined;
  readonly message: string;
  readonly preview: MoneyManagerPreviewRow;
  readonly status: DryRunStatus;
}

export function dryRunMoneyManagerRows(
  previewRows: readonly MoneyManagerPreviewRow[],
  accounts: readonly Account[],
  categories: readonly Category[],
  transactions: readonly Transaction[],
): readonly MoneyManagerDryRunRow[] {
  return previewRows.map((preview) => dryRunRow(preview, accounts, categories, transactions));
}

function dryRunRow(
  preview: MoneyManagerPreviewRow,
  accounts: readonly Account[],
  categories: readonly Category[],
  transactions: readonly Transaction[],
): MoneyManagerDryRunRow {
  if (
    preview.status !== "ready" ||
    preview.amountMinor === undefined ||
    preview.date === undefined
  ) {
    return {
      accountId: undefined,
      categoryId: undefined,
      kind: undefined,
      message: preview.message,
      preview,
      status: "needs_review",
    };
  }
  const account = findByName(accounts, preview.account);
  if (account === undefined || account.isArchived) {
    return {
      accountId: undefined,
      categoryId: undefined,
      kind: undefined,
      message: "Conto non risolto o archiviato: richiede revisione.",
      preview,
      status: "needs_review",
    };
  }
  if (account.currency !== preview.currency) {
    return {
      accountId: account.id,
      categoryId: undefined,
      kind: undefined,
      message: "La valuta della riga non coincide con il conto: richiede revisione.",
      preview,
      status: "needs_review",
    };
  }
  const ownCounterparty = accounts.find(
    (candidate) =>
      candidate.id !== account.id &&
      !candidate.isArchived &&
      normalize(candidate.name) === normalize(preview.payee),
  );
  if (ownCounterparty !== undefined) {
    return {
      accountId: account.id,
      categoryId: undefined,
      kind: undefined,
      message: "Possibile trasferimento tra conti propri: richiede revisione manuale.",
      preview,
      status: "needs_review",
    };
  }
  const kind = preview.amountMinor > 0n ? "income" : "expense";
  const category =
    preview.category === undefined ? undefined : findByName(categories, preview.category);
  if (
    preview.category !== undefined &&
    (category === undefined || category.isArchived || !category.accepts(kind))
  ) {
    return {
      accountId: account.id,
      categoryId: undefined,
      kind,
      message: "Categoria non risolta o incompatibile: richiede revisione.",
      preview,
      status: "needs_review",
    };
  }
  const duplicate = transactions.some(
    (transaction) =>
      transaction.source === "import" &&
      transaction.accountId === account.id &&
      transaction.bookedDate.toString() === preview.date &&
      transaction.amount.amountMinor === preview.amountMinor &&
      normalize(transaction.payee) === normalize(preview.payee),
  );
  if (duplicate) {
    return {
      accountId: account.id,
      categoryId: category?.id,
      kind,
      message: "Duplicato rilevato: non verrà importato.",
      preview,
      status: "skipped_duplicate",
    };
  }
  return {
    accountId: account.id,
    categoryId: category?.id,
    kind,
    message: "Riga pronta per il commit atomico del batch.",
    preview,
    status: "ready",
  };
}

function findByName<T extends { readonly name: string }>(
  items: readonly T[],
  name: string | undefined,
): T | undefined {
  return items.find((item) => normalize(item.name) === normalize(name));
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("it-IT").replaceAll(/\s+/g, " ");
}
