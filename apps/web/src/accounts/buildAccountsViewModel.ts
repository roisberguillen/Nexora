import {
  calculateAccountBalance,
  calculateTotalBalance,
  type Account,
  type Money,
  type Transaction,
} from "@nexora/domain";

export interface AccountsLedgerData {
  readonly accounts: readonly Account[];
  readonly transactions: readonly Transaction[];
}

export interface AccountManagementItem {
  readonly balance: Money;
  readonly canEditOpeningBalance: boolean;
  readonly currency: string;
  readonly id: string;
  readonly institution: string | undefined;
  readonly isArchived: boolean;
  readonly name: string;
  readonly openingBalance: Money;
  readonly parentAccountId: string | undefined;
  readonly parentLabel: string | undefined;
  readonly type: Account["type"];
  readonly typeLabel: string;
}

export interface AccountParentOption {
  readonly currency: string;
  readonly id: string;
  readonly name: string;
}

export interface AccountsViewModel {
  readonly accounts: readonly AccountManagementItem[];
  readonly activeCount: number;
  readonly archivedCount: number;
  readonly parentOptions: readonly AccountParentOption[];
  readonly totalEur: Money;
}

export function buildAccountsViewModel(data: AccountsLedgerData): AccountsViewModel {
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));
  const transactionAccountIds = new Set(
    data.transactions.map((transaction) => transaction.accountId),
  );

  return Object.freeze({
    accounts: Object.freeze(
      data.accounts
        .map((account) =>
          Object.freeze({
            balance: calculateAccountBalance(account, data.transactions),
            canEditOpeningBalance: !transactionAccountIds.has(account.id),
            currency: account.currency,
            id: account.id,
            institution: account.institution,
            isArchived: account.isArchived,
            name: account.name,
            openingBalance: account.openingBalance,
            parentAccountId: account.parentAccountId,
            parentLabel:
              account.parentAccountId === undefined
                ? undefined
                : accountById.get(account.parentAccountId)?.name,
            type: account.type,
            typeLabel: accountTypeLabel(account.type),
          }),
        )
        .sort(compareAccounts),
    ),
    activeCount: data.accounts.filter((account) => !account.isArchived).length,
    archivedCount: data.accounts.filter((account) => account.isArchived).length,
    parentOptions: Object.freeze(
      data.accounts
        .filter((account) => account.type !== "virtual_subaccount" && !account.isArchived)
        .map((account) =>
          Object.freeze({
            currency: account.currency,
            id: account.id,
            name: account.name,
          }),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "it-IT")),
    ),
    totalEur: calculateTotalBalance(data.accounts, data.transactions, "EUR"),
  });
}

function compareAccounts(left: AccountManagementItem, right: AccountManagementItem): number {
  if (left.isArchived !== right.isArchived) {
    return left.isArchived ? 1 : -1;
  }
  return left.name.localeCompare(right.name, "it-IT");
}

export function accountTypeLabel(type: Account["type"]): string {
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
      return "Sottoconto virtuale";
    default:
      return assertNever(type);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported account type: ${String(value)}`);
}
