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
        "listAllTransactionSplits",
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
      transactionSplits: [],
      transfers: [],
      trashedTransactions: [],
    });
    expect(repository.listAccounts).toHaveBeenCalledOnce();
    expect(repository.listTrashedTransactions).toHaveBeenCalledOnce();
  });

  it.each([
    ["listTransactions", "NX-READ-TRANSACTIONS"],
    ["listMonthlyJournals", "NX-READ-JOURNALS"],
    ["listTrashedTransactions", "NX-READ-TRASH"],
  ] as const)("identifies a failed %s read without exposing records", async (method, code) => {
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
        "listAllTransactionSplits",
        "listTransfers",
        "listTrashedTransactions",
      ].map((name) => [
        name,
        vi.fn(async () => {
          if (name === method) throw new Error("repository unavailable");
          return [];
        }),
      ]),
    ) as unknown as LedgerSnapshotRepository;

    await expect(readLedgerSnapshot(repository)).rejects.toMatchObject({
      code,
      name: "LedgerReadError",
    });
  });
});
