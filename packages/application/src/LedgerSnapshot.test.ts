import { describe, expect, it, vi } from "vitest";

import { readLedgerSnapshot, type LedgerSnapshotRepository } from "./LedgerSnapshot";

describe("readLedgerSnapshot", () => {
  it("reads the complete UI snapshot through the repository port", async () => {
    const repository = Object.fromEntries(
      [
        "listAccounts",
        "listAllocationPlans",
        "listBudgets",
        "listCategories",
        "listImportBatches",
        "listInvestmentPositions",
        "listLoans",
        "listMonthlyJournals",
        "listRecurringRules",
        "listTags",
        "listTransactions",
        "listTransfers",
        "listTrashedTransactions",
      ].map((name) => [name, vi.fn(async () => [])]),
    ) as unknown as LedgerSnapshotRepository;

    const snapshot = await readLedgerSnapshot(repository);

    expect(snapshot).toEqual({
      accounts: [],
      allocationPlans: [],
      budgets: [],
      categories: [],
      importBatches: [],
      investmentPositions: [],
      loans: [],
      monthlyJournals: [],
      recurringRules: [],
      tags: [],
      transactions: [],
      transfers: [],
      trashedTransactions: [],
    });
    expect(repository.listAccounts).toHaveBeenCalledOnce();
    expect(repository.listTrashedTransactions).toHaveBeenCalledOnce();
  });
});
