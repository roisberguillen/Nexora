import type { Account, Category, Transaction, TransactionKind } from "@nexora/domain";

import type { MoneyManagerPreviewRow } from "./moneyManagerPreview";
import type { MoneyManagerSemanticPlan } from "./moneyManagerSemanticPlan";

export type DryRunStatus = "needs_review" | "ready" | "skipped_duplicate";

export interface MoneyManagerDryRunRow {
  readonly accountId: string | undefined;
  readonly categoryId: string | undefined;
  readonly kind: TransactionKind | undefined;
  readonly message: string;
  readonly preview: MoneyManagerPreviewRow;
  readonly status: DryRunStatus;
  readonly transferCandidateAccountId?: string;
}

export function dryRunMoneyManagerRows(
  previewRows: readonly MoneyManagerPreviewRow[],
  accounts: readonly Account[],
  categories: readonly Category[],
  transactions: readonly Transaction[],
  semanticPlan?: MoneyManagerSemanticPlan,
): readonly MoneyManagerDryRunRow[] {
  return previewRows.map((preview) =>
    dryRunRow(preview, accounts, categories, transactions, semanticPlan),
  );
}

function dryRunRow(
  preview: MoneyManagerPreviewRow,
  accounts: readonly Account[],
  categories: readonly Category[],
  transactions: readonly Transaction[],
  semanticPlan: MoneyManagerSemanticPlan | undefined,
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
  const plannedAccounts = [...accounts, ...(semanticPlan?.accountsToCreate ?? [])];
  const accountPlan = semanticPlan?.accounts.find(
    (item) => normalize(item.sourceName) === normalize(preview.account),
  );
  const account =
    accountPlan?.targetAccountId === undefined
      ? findByName(accounts, preview.account)
      : plannedAccounts.find((candidate) => candidate.id === accountPlan.targetAccountId);
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
  if (/^trasferimento (?:uscita|entrata)$/i.test(preview.sourceType ?? "")) {
    const destinationPlan = semanticPlan?.accounts.find(
      (item) => normalize(item.sourceName) === normalize(preview.sourceCategory),
    );
    const destinationAccountId = destinationPlan?.targetAccountId;
    const destination = plannedAccounts.find((candidate) => candidate.id === destinationAccountId);
    if (
      destination === undefined ||
      destination.isArchived ||
      destination.currency !== account.currency
    )
      return {
        accountId: account.id,
        categoryId: undefined,
        kind: undefined,
        message: "Trasferimento Money Manager: conto destinazione non risolto.",
        preview,
        status: "needs_review",
      };
    if (isDuplicate(transactions, account, preview)) {
      return {
        accountId: account.id,
        categoryId: undefined,
        kind: "transfer",
        message: "Duplicato rilevato: non verrà importato.",
        preview,
        status: "skipped_duplicate",
        transferCandidateAccountId: destination.id,
      };
    }
    return {
      accountId: account.id,
      categoryId: undefined,
      kind: "transfer",
      message: "Trasferimento Money Manager pronto per il commit atomico.",
      preview,
      status: "ready",
      transferCandidateAccountId: destination.id,
    };
  }
  if (/^modifica saldo$/i.test(preview.sourceCategory ?? preview.category ?? "")) {
    if (isDuplicate(transactions, account, preview)) {
      return {
        accountId: account.id,
        categoryId: undefined,
        kind: "adjustment",
        message: "Duplicato rilevato: non verrà importato.",
        preview,
        status: "skipped_duplicate",
      };
    }
    return {
      accountId: account.id,
      categoryId: undefined,
      kind: "adjustment",
      message: "Rettifica saldo Money Manager pronta per il commit atomico.",
      preview,
      status: "ready",
    };
  }
  const ownCounterparty = accounts.find(
    (candidate) =>
      candidate.id !== account.id &&
      !candidate.isArchived &&
      normalize(candidate.name) === normalize(preview.payee),
  );
  if (ownCounterparty !== undefined) {
    if (isDuplicate(transactions, account, preview)) {
      return {
        accountId: account.id,
        categoryId: undefined,
        kind: undefined,
        message: "Duplicato rilevato: non verrà importato.",
        preview,
        status: "skipped_duplicate",
        transferCandidateAccountId: ownCounterparty.id,
      };
    }
    return {
      accountId: account.id,
      categoryId: undefined,
      kind: undefined,
      message: "Possibile trasferimento tra conti propri: richiede revisione manuale.",
      preview,
      status: "needs_review",
      transferCandidateAccountId: ownCounterparty.id,
    };
  }
  const kind = preview.amountMinor > 0n ? "income" : "expense";
  const categoryPlan = semanticPlan?.categories.find(
    (item) =>
      normalize(item.sourceCategory) === normalize(preview.sourceCategory ?? preview.category) &&
      normalize(item.sourceSubcategory) === normalize(preview.sourceSubcategory),
  );
  const category =
    categoryPlan?.targetCategoryId === undefined
      ? resolveCategory(
          categories,
          preview.sourceCategory ?? preview.category,
          preview.sourceSubcategory,
        )
      : [...categories, ...(semanticPlan?.categoriesToCreate ?? [])].find(
          (candidate) => candidate.id === categoryPlan.targetCategoryId,
        );
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
  const duplicate = isDuplicate(transactions, account, preview);
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

function isDuplicate(
  transactions: readonly Transaction[],
  account: Account,
  preview: MoneyManagerPreviewRow,
): boolean {
  return transactions.some(
    (transaction) =>
      transaction.source === "import" &&
      transaction.accountId === account.id &&
      transaction.bookedDate.toString() === preview.date &&
      transaction.amount.amountMinor === preview.amountMinor &&
      normalize(transaction.payee) === normalize(preview.payee),
  );
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

function resolveCategory(
  categories: readonly Category[],
  sourceCategory: string | undefined,
  sourceSubcategory: string | undefined,
): Category | undefined {
  const macro = findByName(categories, sourceCategory);
  if (sourceSubcategory === undefined || sourceSubcategory === "") return macro;
  return categories.find(
    (category) =>
      category.parentId === macro?.id && normalize(category.name) === normalize(sourceSubcategory),
  );
}
