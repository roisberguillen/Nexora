import { createEncryptedPayloadBackup } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { verifyRecoveryBackup } from "./RecoveryBackupVerification";

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
});
