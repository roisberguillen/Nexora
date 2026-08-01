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

export type LedgerReadCode =
  | "NX-READ-ACCOUNTS"
  | "NX-READ-ALLOCATION-PLANS"
  | "NX-READ-BUDGETS"
  | "NX-READ-CATEGORIES"
  | "NX-READ-IMPORTS"
  | "NX-READ-INVESTMENTS"
  | "NX-READ-LOANS"
  | "NX-READ-JOURNALS"
  | "NX-READ-RECURRING"
  | "NX-READ-TAGS"
  | "NX-READ-TRANSACTIONS"
  | "NX-READ-TRANSFERS"
  | "NX-READ-TRASH";

/** Safe, entity-level startup context. It deliberately never includes record data. */
export class LedgerReadError extends Error {
  public constructor(
    readonly code: LedgerReadCode,
    readonly operation: string,
    cause: unknown,
  ) {
    super(`The ledger ${operation} read failed.`, { cause });
    this.name = "LedgerReadError";
  }
}

export async function readLedgerSnapshot(
  repository: LedgerSnapshotRepository,
): Promise<LedgerSnapshot> {
  const accounts = await readLedgerCollection("NX-READ-ACCOUNTS", "accounts", () =>
    repository.listAccounts(),
  );
  const [
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
    readLedgerCollection("NX-READ-ALLOCATION-PLANS", "allocation plans", () =>
      repository.listAllocationPlans(),
    ),
    readLedgerCollection("NX-READ-BUDGETS", "budgets", () => repository.listBudgets()),
    readLedgerCollection("NX-READ-CATEGORIES", "categories", () => repository.listCategories()),
    readLedgerCollection("NX-READ-IMPORTS", "import batches", () => repository.listImportBatches()),
    readLedgerCollection("NX-READ-INVESTMENTS", "investment positions", () =>
      repository.listInvestmentPositions(),
    ),
    readLedgerCollection("NX-READ-LOANS", "loans", () => repository.listLoans()),
    readLedgerCollection("NX-READ-JOURNALS", "monthly journals", () =>
      repository.listMonthlyJournals(),
    ),
    readLedgerCollection("NX-READ-RECURRING", "recurring rules", () =>
      repository.listRecurringRules(),
    ),
    readLedgerCollection("NX-READ-TAGS", "tags", () => repository.listTags()),
    readLedgerCollection("NX-READ-TRANSACTIONS", "transactions", () =>
      repository.listTransactions(),
    ),
    readLedgerCollection("NX-READ-TRANSFERS", "transfers", () => repository.listTransfers()),
    readLedgerCollection("NX-READ-TRASH", "trashed transactions", () =>
      repository.listTrashedTransactions(),
    ),
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

async function readLedgerCollection<T>(
  code: LedgerReadCode,
  operation: string,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (cause) {
    throw new LedgerReadError(code, operation, cause);
  }
}
