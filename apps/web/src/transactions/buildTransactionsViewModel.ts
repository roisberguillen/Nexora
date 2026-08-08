import {
  categoryLabel,
  type Account,
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
}

export interface TransactionListItem {
  readonly accountLabel: string;
  readonly amount: Money;
  readonly bookedDate: string;
  readonly canCancel: boolean;
  readonly categoryLabel: string;
  readonly id: string;
  readonly isTransfer: boolean;
  readonly kindLabel: string;
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
      accountLabel: `${accountById.get(debit.accountId)?.name ?? "Conto non disponibile"} → ${accountById.get(credit.accountId)?.name ?? "Conto non disponibile"}`,
      amount: debit.amount.negate(),
      bookedDate: debit.bookedDate.value,
      canCancel: debit.status !== "cancelled" && debit.status !== "reconciled",
      categoryLabel: "Trasferimento interno",
      id: transfer.id,
      isTransfer: true,
      kindLabel: "Trasferimento",
      statusLabel: statusLabel(debit.status),
      title: debit.description ?? "Trasferimento interno",
    } as const;
  });

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
  });
}

function itemForTransaction(
  transaction: Transaction,
  accountById: ReadonlyMap<string, Account>,
  categoryById: ReadonlyMap<string, Category>,
): TransactionListItem {
  return Object.freeze({
    accountLabel: accountById.get(transaction.accountId)?.name ?? "Conto non disponibile",
    amount: transaction.amount,
    bookedDate: transaction.bookedDate.value,
    canCancel: transaction.status !== "cancelled" && transaction.status !== "reconciled",
    categoryLabel:
      transaction.categoryId === undefined
        ? "Senza categoria"
        : categoryById.get(transaction.categoryId) === undefined
          ? "Categoria non disponibile"
          : categoryLabel(categoryById.get(transaction.categoryId)!, [...categoryById.values()]),
    id: transaction.id,
    isTransfer: false,
    kindLabel: kindLabel(transaction.kind),
    statusLabel: statusLabel(transaction.status),
    title: transaction.payee ?? transaction.description ?? kindLabel(transaction.kind),
  });
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
