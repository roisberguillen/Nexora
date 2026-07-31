import type {
  Account,
  AllocationPlan,
  Budget,
  Category,
  ImportBatch,
  InvestmentPosition,
  LedgerRepository,
  Loan,
  MonthlyJournal,
  RecurringRule,
  Tag,
  TrashedTransaction,
  Transaction,
  Transfer,
} from "@nexora/domain";

/**
 * Cross-platform read model: the UI receives domain entities, never a concrete persistence
 * adapter. Platform-specific bootstraps supply the repository implementation.
 */
export interface LedgerSnapshot {
  readonly accounts: readonly Account[];
  readonly allocationPlans: readonly AllocationPlan[];
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  readonly importBatches: readonly ImportBatch[];
  readonly investmentPositions: readonly InvestmentPosition[];
  readonly loans: readonly Loan[];
  readonly monthlyJournals: readonly MonthlyJournal[];
  readonly recurringRules: readonly RecurringRule[];
  readonly tags: readonly Tag[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly Transfer[];
  readonly trashedTransactions: readonly TrashedTransaction[];
}

export type LedgerSnapshotRepository = Pick<
  LedgerRepository,
  | "listAccounts"
  | "listAllocationPlans"
  | "listBudgets"
  | "listCategories"
  | "listImportBatches"
  | "listInvestmentPositions"
  | "listLoans"
  | "listMonthlyJournals"
  | "listRecurringRules"
  | "listTags"
  | "listTransactions"
  | "listTransfers"
  | "listTrashedTransactions"
>;

export async function readLedgerSnapshot(
  repository: LedgerSnapshotRepository,
): Promise<LedgerSnapshot> {
  const [
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
    transfers,
    trashedTransactions,
  ] = await Promise.all([
    repository.listAccounts(),
    repository.listAllocationPlans(),
    repository.listBudgets(),
    repository.listCategories(),
    repository.listImportBatches(),
    repository.listInvestmentPositions(),
    repository.listLoans(),
    repository.listMonthlyJournals(),
    repository.listRecurringRules(),
    repository.listTags(),
    repository.listTransactions(),
    repository.listTransfers(),
    repository.listTrashedTransactions(),
  ]);

  return Object.freeze({
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
    transfers,
    trashedTransactions,
  });
}
