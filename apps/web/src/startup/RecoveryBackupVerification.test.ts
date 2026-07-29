import { createEncryptedPayloadBackup, type IndexedDbLedger } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import {
  restorePortableBackupTemporarily,
  verifyRecoveryBackup,
} from "./RecoveryBackupVerification";

const passphrase = "recovery-test-passphrase";

describe("verifyRecoveryBackup", () => {
  it("verifica un backup SQLite senza aprire un ledger attivo", async () => {
    const archive = await createEncryptedPayloadBackup({
      payloadBytes: new Uint8Array(100).fill(1),
      path: "database.sqlite3",
      schemaVersion: 13,
      createdAt: "2026-07-30T00:00:00.000Z",
      passphrase,
    });

    await expect(verifyRecoveryBackup(archive, passphrase)).resolves.toEqual({
      kind: "sqlite",
      schemaVersion: 13,
      createdAt: "2026-07-30T00:00:00.000Z",
    });
  });

  it("rifiuta una passphrase errata senza produrre effetti collaterali", async () => {
    await expect(verifyRecoveryBackup(new Uint8Array([1, 2, 3]), passphrase)).rejects.toBeDefined();
  });

  it("ripristina un backup portabile in un archivio temporaneo e lo rimuove", async () => {
    const close = vi.fn(async () => undefined);
    const deleteTemporaryLedger = vi.fn(async () => undefined);
    const ledger = {
      repository: {
        replacePortableSnapshot: vi.fn(async () => undefined),
        listTransactions: vi.fn(async () => []),
      },
      close,
    } as unknown as IndexedDbLedger;

    await expect(
      restorePortableBackupTemporarily(new Uint8Array([1]), passphrase, {
        createTemporaryLedger: async () => ledger,
        deleteTemporaryLedger,
        createId: () => "safe-copy",
        decryptArchive: async () => ({
          manifest: {
            formatVersion: 1,
            schemaVersion: 13,
            createdAt: "2026-07-30T00:00:00.000Z",
            files: [{ path: "ledger.json", sha256: "0".repeat(64), size: 1 }],
          },
          payloadBytes: new TextEncoder().encode(
            '{"formatVersion":1,"entities":{"accounts":[],"categories":[],"tags":[],"transactions":[],"transfers":[],"importBatches":[],"recurringRules":[],"allocationPlans":[],"budgets":[],"loans":[],"investmentPositions":[],"monthlyJournals":[]},"relations":{"splits":[],"transactionTags":[],"importRows":[]}}',
          ),
        }),
      }),
    ).resolves.toMatchObject({ kind: "portable-ledger", restoredTransactions: 0 });
    expect(close).toHaveBeenCalledOnce();
    expect(deleteTemporaryLedger).toHaveBeenCalledWith("nexora-recovery-safe-copy");
  });
});
