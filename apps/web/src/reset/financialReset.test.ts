import { describe, expect, it, vi } from "vitest";

import {
  createVerifiedResetBackup,
  previewFinancialReset,
  writeFinancialResetReceipt,
} from "./financialReset";

describe("financial reset preview", () => {
  it("counts financial data and keeps only non-financial local settings", async () => {
    const repository = Object.fromEntries(
      [
        "listAccounts",
        "listCategories",
        "listTransactions",
        "listImportBatches",
        "listRecurringRules",
        "listAllocationPlans",
        "listBudgets",
        "listLoans",
        "listInvestmentPositions",
      ].map((name) => [name, vi.fn(async () => [{ id: name }])]),
    );
    const preview = await previewFinancialReset({ repository, storageKind: "indexeddb" } as never);
    expect(preview).toMatchObject({ accounts: 1, transactions: 1, plans: 2 });
    expect(preview.kept).toContain("Preferenze dell’app");
  });

  it("stores a receipt without financial content", () => {
    const setItem = vi.fn();
    writeFinancialResetReceipt(
      {
        version: 1,
        occurredAt: "2026-07-29T12:00:00.000Z",
        storageKind: "indexeddb",
        reset: {
          accounts: 1,
          categories: 2,
          transactions: 3,
          imports: 0,
          plans: 0,
          budgets: 0,
          loans: 0,
          investments: 0,
          kept: [],
        },
      },
      { setItem } as never,
    );
    expect(setItem).toHaveBeenCalledWith("nexora.financial-reset-receipt.v1", expect.any(String));
  });

  it("verifies the encrypted archive before handing it to the user", async () => {
    const createEncryptedBackupArchive = vi.fn(async () => ({
      id: "reset.nexora-backup",
      archive: new Uint8Array([1, 2, 3]),
      checksumSha256: "a".repeat(64),
    }));
    const verifyEncryptedBackupArchive = vi.fn(async () => undefined);
    const saveArchive = vi.fn();
    await expect(
      createVerifiedResetBackup(
        { createEncryptedBackupArchive, verifyEncryptedBackupArchive } as never,
        "una-passphrase-lunga",
        saveArchive,
      ),
    ).resolves.toBe("aaaaaaaaaaaa");
    expect(verifyEncryptedBackupArchive).toHaveBeenCalledOnce();
    expect(saveArchive).toHaveBeenCalledWith(expect.any(Uint8Array), "reset.nexora-backup");
  });
});
