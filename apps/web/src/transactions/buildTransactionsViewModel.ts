import { DEFAULT_CURRENCY } from "@nexora/config";
import {
  categoryLabel,
  summarizeCashFlow,
  type Account,
  type CashFlowSummary,
  type Category,
  type Money,
  type Transaction,
  type Transfer,
} from "@nexora/domain";

export interface TransactionsViewModel {
  readonly accounts: readonly {
    readonly id: string;
    readonly name: string;
    readonly currency: string;
  }[];
  readonly categories: readonly {
    readonly id: string;
    readonly name: string;
    readonly kindScope: Category["kindScope"];
    readonly parentId: string | undefined;
  }[];
  readonly items: readonly TransactionListItem[];
  readonly cashFlow: CashFlowSummary;
  readonly cashFlowByMonth: Readonly<Record<string, CashFlowSummary>>;
  readonly emptyCashFlow: CashFlowSummary;
}

export interface TransactionListItem {
  readonly accountId?: string;
  readonly accountLabel: string;
  readonly amount: Money;
  readonly bookedDate: string;
  readonly description?: string;
  readonly canCancel: boolean;
  readonly categoryLabel: string;
  readonly categoryId?: string | undefined;
  readonly id: string;
  readonly isTransfer: boolean;
  readonly kindLabel: string;
  readonly kind?: Transaction["kind"];
  readonly source?: Transaction["source"];
  readonly status?: Transaction["status"];
  readonly payee?: string;
  readonly statusLabel: string;
  readonly title: string;
}

export function buildTransactionsViewModel(data: {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly Transfer[];
}): TransactionsViewModel {
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const transactionById = new Map(
    data.transactions.map((transaction) => [transaction.id, transaction]),
  );
  const transferLegIds = new Set(
    data.transfers.flatMap((transfer) => [
      transfer.debitTransactionId,
      transfer.creditTransactionId,
    ]),
  );
  const standalone = data.transactions
    .filter((transaction) => !transferLegIds.has(transaction.id))
    .map((transaction) => itemForTransaction(transaction, accountById, categoryById));
  const transfers = data.transfers.map((transfer) => {
    const debit = transactionById.get(transfer.debitTransactionId);
    const credit = transactionById.get(transfer.creditTransactionId);
    if (debit === undefined || credit === undefined) {
      throw new Error("A persisted transfer is missing one or more ledger legs.");
    }
    return {
      accountId: debit.accountId,
      accountLabel: `${accountById.get(debit.accountId)?.name ?? "Conto non disponibile"} → ${accountById.get(credit.accountId)?.name ?? "Conto non disponibile"}`,
      amount: debit.amount.negate(),
      bookedDate: debit.bookedDate.value,
      description: debit.description ?? "",
      canCancel: debit.status !== "cancelled" && debit.status !== "reconciled",
      categoryLabel: "Trasferimento interno",
      categoryId: undefined,
      id: transfer.id,
      isTransfer: true,
      kindLabel: "Trasferimento",
      kind: "transfer",
      source: debit.source,
      status: debit.status,
      payee: "",
      statusLabel: statusLabel(debit.status),
      title: transactionListTitle(debit.description, undefined, "Trasferimento interno"),
    } as const;
  });
  const cashFlowByMonth = Object.fromEntries(
    [
      ...new Set(data.transactions.map((transaction) => transaction.bookedDate.value.slice(0, 7))),
    ].map((month) => [
      month,
      summarizeCashFlow(
        data.transactions.filter((transaction) => transaction.bookedDate.value.startsWith(month)),
        DEFAULT_CURRENCY,
      ),
    ]),
  ) as Record<string, CashFlowSummary>;

  return Object.freeze({
    accounts: Object.freeze(
      data.accounts
        .filter((account) => !account.isArchived)
        .map((account) =>
          Object.freeze({ id: account.id, name: account.name, currency: account.currency }),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "it-IT")),
    ),
    categories: Object.freeze(
      data.categories
        .filter((category) => !category.isArchived)
        .map((category) =>
          Object.freeze({
            id: category.id,
            name: category.name,
            kindScope: category.kindScope,
            parentId: category.parentId,
          }),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "it-IT")),
    ),
    items: Object.freeze(
      [...standalone, ...transfers].sort(
        (left, right) =>
          right.bookedDate.localeCompare(left.bookedDate) || left.id.localeCompare(right.id),
      ),
    ),
    cashFlow: summarizeCashFlow(data.transactions, DEFAULT_CURRENCY),
    cashFlowByMonth: Object.freeze(cashFlowByMonth),
    emptyCashFlow: summarizeCashFlow([], DEFAULT_CURRENCY),
  });
}

function itemForTransaction(
  transaction: Transaction,
  accountById: ReadonlyMap<string, Account>,
  categoryById: ReadonlyMap<string, Category>,
): TransactionListItem {
  return Object.freeze({
    accountId: transaction.accountId,
    accountLabel: accountById.get(transaction.accountId)?.name ?? "Conto non disponibile",
    amount: transaction.amount,
    bookedDate: transaction.bookedDate.value,
    description: transaction.description ?? "",
    canCancel: transaction.status !== "cancelled" && transaction.status !== "reconciled",
    categoryLabel:
      transaction.categoryId === undefined
        ? "Senza categoria"
        : categoryById.get(transaction.categoryId) === undefined
          ? "Categoria non disponibile"
          : categoryLabel(categoryById.get(transaction.categoryId)!, [...categoryById.values()]),
    categoryId: transaction.categoryId,
    id: transaction.id,
    isTransfer: false,
    kindLabel: kindLabel(transaction.kind),
    kind: transaction.kind,
    source: transaction.source,
    status: transaction.status,
    payee: transaction.payee ?? "",
    statusLabel: statusLabel(transaction.status),
    title: transactionListTitle(
      transaction.payee,
      transaction.description,
      kindLabel(transaction.kind),
    ),
  });
}

/** Keeps the primary list label meaningful when optional imported fields are blank. */
export function transactionListTitle(
  payee: string | undefined,
  description: string | undefined,
  fallback: string,
): string {
  return [payee, description, fallback].find((value) => value?.trim().length)!.trim();
}

function kindLabel(kind: Transaction["kind"]): string {
  return (
    {
      income: "Entrata",
      expense: "Spesa",
      adjustment: "Rettifica",
      transfer: "Trasferimento",
    } as const
  )[kind];
}

function statusLabel(status: Transaction["status"]): string {
  return (
    {
      expected: "Previsto",
      booked: "Contabilizzato",
      reconciled: "Riconciliato",
      cancelled: "Annullato",
    } as const
  )[status];
}
