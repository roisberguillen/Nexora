import { readLedgerSnapshot } from "@nexora/application";
import type {
  Account,
  AllocationPlan,
  Budget,
  Category,
  ImportBatch,
  InvestmentPosition,
  Loan,
  MonthlyJournal,
  RecurringRule,
  Tag,
  Transaction,
  TransactionSplit,
  TrashedTransaction,
} from "@nexora/domain";
import type { Ledger } from "@nexora/database";

import { buildAccountsViewModel, type AccountsViewModel } from "./accounts/buildAccountsViewModel";
import {
  buildDashboardViewModel,
  type DashboardViewModel,
} from "./dashboard/buildDashboardViewModel";
import {
  buildTransactionsViewModel,
  type TransactionsViewModel,
} from "./transactions/buildTransactionsViewModel";

export interface AppModels {
  readonly budgets: readonly Budget[];
  readonly loans: readonly Loan[];
  readonly investmentPositions: readonly InvestmentPosition[];
  readonly monthlyJournals: readonly MonthlyJournal[];
  readonly importBatches: readonly ImportBatch[];
  readonly recurringRules: readonly RecurringRule[];
  readonly allocationPlans: readonly AllocationPlan[];
  readonly rawAccounts: readonly Account[];
  readonly rawTransactions: readonly Transaction[];
  readonly transactionSplits: readonly TransactionSplit[];
  readonly accounts: AccountsViewModel;
  readonly categories: readonly Category[];
  readonly tags: readonly Tag[];
  readonly trashedTransactions: readonly TrashedTransaction[];
  readonly dashboard: DashboardViewModel;
  readonly transactions: TransactionsViewModel;
}

/** Identifies a failed derived UI model without exposing ledger contents. */
export class AppModelBuildError extends Error {
  public constructor(
    readonly model: "accounts" | "dashboard" | "transactions",
    cause: unknown,
  ) {
    super(`The ${model} UI model could not be built.`, { cause });
    this.name = "AppModelBuildError";
  }
}

export async function loadAppModels(ledger: Ledger): Promise<AppModels> {
  const snapshot = await readLedgerSnapshot(ledger.repository);
  const {
    accounts,
    allocationPlans,
    budgets,
    categories,
    importBatches,
    investmentPositions,
    loans,
    monthlyJournals,
    recurringRules,
    tags,
    transactions,
    transactionSplits,
    transfers,
    trashedTransactions,
  } = snapshot;
  let accountsModel: AccountsViewModel;
  let dashboardModel: DashboardViewModel;
  let transactionsModel: TransactionsViewModel;
  try {
    accountsModel = buildAccountsViewModel({ accounts, transactions });
  } catch (cause) {
    throw new AppModelBuildError("accounts", cause);
  }
  try {
    dashboardModel = buildDashboardViewModel({
      accounts,
      categories,
      loans,
      investmentPositions,
      transactions,
      transfers,
    });
  } catch (cause) {
    throw new AppModelBuildError("dashboard", cause);
  }
  try {
    transactionsModel = buildTransactionsViewModel({
      accounts,
      categories,
      transactions,
      transfers,
    });
  } catch (cause) {
    throw new AppModelBuildError("transactions", cause);
  }
  return {
    allocationPlans,
    budgets,
    loans,
    investmentPositions,
    monthlyJournals,
    importBatches,
    recurringRules,
    rawAccounts: accounts,
    rawTransactions: transactions,
    transactionSplits,
    categories,
    tags,
    trashedTransactions,
    accounts: accountsModel,
    dashboard: dashboardModel,
    transactions: transactionsModel,
  };
}
