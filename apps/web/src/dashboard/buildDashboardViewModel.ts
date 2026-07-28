import {
  calculateAccountBalance,
  calculateTotalBalance,
  summarizeCashFlow,
  type Account,
  type Category,
  type Money,
  type Transaction,
  type TransactionKind,
  type TransactionStatus,
  type Transfer,
} from "@nexora/domain";

const defaultCurrency = "EUR";
const recentActivityLimit = 6;

export interface DashboardLedgerData {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly Transfer[];
}

export interface DashboardCounts {
  readonly accounts: number;
  readonly categories: number;
  readonly transactions: number;
  readonly transfers: number;
}

export interface DashboardAccountItem {
  readonly balance: Money;
  readonly id: string;
  readonly institution: string | undefined;
  readonly isArchived: boolean;
  readonly name: string;
  readonly typeLabel: string;
}

export type DashboardActivityTone = "negative" | "neutral" | "positive";

export interface DashboardActivityItem {
  readonly accountLabel: string;
  readonly amount: Money;
  readonly bookedDate: string;
  readonly categoryLabel: string;
  readonly id: string;
  readonly isCancelled: boolean;
  readonly kindLabel: string;
  readonly title: string;
  readonly tone: DashboardActivityTone;
}

export interface DashboardViewModel {
  readonly accounts: readonly DashboardAccountItem[];
  readonly activity: readonly DashboardActivityItem[];
  readonly counts: DashboardCounts;
  readonly currency: string;
  readonly excludedCurrencyAccountCount: number;
  readonly expense: Money;
  readonly income: Money;
  readonly netCashFlow: Money;
  readonly netWorth: Money;
}

export function buildDashboardViewModel(
  data: DashboardLedgerData,
  currency = defaultCurrency,
): DashboardViewModel {
  const cashFlow = summarizeCashFlow(data.transactions, currency);
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));

  return Object.freeze({
    accounts: Object.freeze(
      data.accounts
        .map((account) =>
          Object.freeze({
            balance: calculateAccountBalance(account, data.transactions),
            id: account.id,
            institution: account.institution,
            isArchived: account.isArchived,
            name: account.name,
            typeLabel: accountTypeLabel(account.type),
          }),
        )
        .sort(compareAccounts),
    ),
    activity: Object.freeze(
      buildActivity(data.transactions, data.transfers, accountById, categoryById)
        .sort(compareActivity)
        .slice(0, recentActivityLimit),
    ),
    counts: Object.freeze({
      accounts: data.accounts.length,
      categories: data.categories.length,
      transactions: data.transactions.length,
      transfers: data.transfers.length,
    }),
    currency,
    excludedCurrencyAccountCount: data.accounts.filter((account) => account.currency !== currency)
      .length,
    expense: cashFlow.expense,
    income: cashFlow.income,
    netCashFlow: cashFlow.net,
    netWorth: calculateTotalBalance(data.accounts, data.transactions, currency),
  });
}

function buildActivity(
  transactions: readonly Transaction[],
  transfers: readonly Transfer[],
  accountById: ReadonlyMap<string, Account>,
  categoryById: ReadonlyMap<string, Category>,
): DashboardActivityItem[] {
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const transferLegIds = new Set(
    transfers.flatMap((transfer) => [transfer.debitTransactionId, transfer.creditTransactionId]),
  );
  const activity = transactions
    .filter((transaction) => !transferLegIds.has(transaction.id))
    .map((transaction) => transactionActivity(transaction, accountById, categoryById));

  for (const transfer of transfers) {
    const debit = transactionById.get(transfer.debitTransactionId);
    const credit = transactionById.get(transfer.creditTransactionId);
    if (debit === undefined || credit === undefined) {
      throw new Error("A persisted transfer is missing one or more ledger legs.");
    }
    activity.push(transferActivity(transfer, debit, credit, accountById));
  }

  return activity;
}

function transactionActivity(
  transaction: Transaction,
  accountById: ReadonlyMap<string, Account>,
  categoryById: ReadonlyMap<string, Category>,
): DashboardActivityItem {
  const category =
    transaction.categoryId === undefined ? undefined : categoryById.get(transaction.categoryId);

  return Object.freeze({
    accountLabel: accountById.get(transaction.accountId)?.name ?? "Conto non disponibile",
    amount: transaction.amount,
    bookedDate: transaction.bookedDate.value,
    categoryLabel: category?.name ?? fallbackCategoryLabel(transaction.kind),
    id: transaction.id,
    isCancelled: transaction.status === "cancelled",
    kindLabel: transactionKindLabel(transaction.kind, transaction.status),
    title:
      transaction.payee ??
      transaction.description ??
      transactionKindLabel(transaction.kind, transaction.status),
    tone: transactionTone(transaction.kind),
  });
}

function transferActivity(
  transfer: Transfer,
  debit: Transaction,
  credit: Transaction,
  accountById: ReadonlyMap<string, Account>,
): DashboardActivityItem {
  const debitAccount = accountById.get(debit.accountId)?.name ?? "Conto non disponibile";
  const creditAccount = accountById.get(credit.accountId)?.name ?? "Conto non disponibile";

  return Object.freeze({
    accountLabel: `${debitAccount} → ${creditAccount}`,
    amount: debit.amount.negate(),
    bookedDate: debit.bookedDate.value,
    categoryLabel: "Trasferimento interno",
    id: transfer.id,
    isCancelled: debit.status === "cancelled",
    kindLabel: transactionKindLabel("transfer", debit.status),
    title: debit.description ?? "Trasferimento interno",
    tone: "neutral",
  });
}

function compareAccounts(left: DashboardAccountItem, right: DashboardAccountItem): number {
  if (left.isArchived !== right.isArchived) {
    return left.isArchived ? 1 : -1;
  }
  return left.name.localeCompare(right.name, "it-IT");
}

function compareActivity(left: DashboardActivityItem, right: DashboardActivityItem): number {
  const byDate = right.bookedDate.localeCompare(left.bookedDate);
  return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
}

function transactionTone(kind: TransactionKind): DashboardActivityTone {
  if (kind === "income") {
    return "positive";
  }
  if (kind === "expense") {
    return "negative";
  }
  return "neutral";
}

function transactionKindLabel(kind: TransactionKind, status: TransactionStatus): string {
  if (status === "cancelled") {
    return "Annullato";
  }
  switch (kind) {
    case "income":
      return "Entrata";
    case "expense":
      return "Spesa";
    case "transfer":
      return "Trasferimento";
    case "adjustment":
      return "Rettifica";
    default:
      return assertNever(kind);
  }
}

function fallbackCategoryLabel(kind: TransactionKind): string {
  return kind === "transfer" ? "Trasferimento interno" : "Senza categoria";
}

function accountTypeLabel(type: Account["type"]): string {
  switch (type) {
    case "checking":
      return "Conto corrente";
    case "savings":
      return "Risparmio";
    case "cash":
      return "Contanti";
    case "investment":
      return "Investimenti";
    case "loan":
      return "Prestito";
    case "virtual_subaccount":
      return "Sottoconto";
    default:
      return assertNever(type);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported dashboard value: ${String(value)}`);
}
