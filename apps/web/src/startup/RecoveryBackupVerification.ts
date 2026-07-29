import {
  decodePortableLedgerSnapshot,
  decryptEncryptedPayloadBackup,
  openIndexedDbLedger,
  type IndexedDbLedger,
  validatePortableLedgerSnapshot,
} from "@nexora/database";

export interface VerifiedRecoveryBackup {
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly kind: "portable-ledger" | "sqlite";
}

export interface TemporaryRestoreResult extends VerifiedRecoveryBackup {
  readonly restoredTransactions: number;
}

export interface TemporaryRestoreDependencies {
  readonly createTemporaryLedger: (databaseName: string) => Promise<IndexedDbLedger>;
  readonly deleteTemporaryLedger: (databaseName: string) => Promise<void>;
  readonly createId: () => string;
  readonly decryptArchive?: typeof decryptEncryptedPayloadBackup;
}

/** Validates a user-selected encrypted backup without opening or mutating the active ledger. */
export async function verifyRecoveryBackup(
  archive: Uint8Array,
  passphrase: string,
): Promise<VerifiedRecoveryBackup> {
  const decrypted = await decryptEncryptedPayloadBackup(archive, passphrase);
  const kind = decrypted.manifest.files[0].path === "ledger.json" ? "portable-ledger" : "sqlite";
  if (kind === "portable-ledger") {
    validatePortableLedgerSnapshot(decodePortableLedgerSnapshot(decrypted.payloadBytes));
  }
  return {
    schemaVersion: decrypted.manifest.schemaVersion,
    createdAt: decrypted.manifest.createdAt,
    kind,
  };
}

/** Restores a portable backup to an isolated IndexedDB and removes it after verification. */
export async function restorePortableBackupTemporarily(
  archive: Uint8Array,
  passphrase: string,
  dependencies: TemporaryRestoreDependencies = defaultTemporaryRestoreDependencies,
): Promise<TemporaryRestoreResult> {
  const decrypted = await (dependencies.decryptArchive ?? decryptEncryptedPayloadBackup)(
    archive,
    passphrase,
  );
  if (decrypted.manifest.files[0].path !== "ledger.json") {
    throw new Error("Solo i backup portabili possono essere ripristinati temporaneamente.");
  }
  const snapshot = validatePortableLedgerSnapshot(
    decodePortableLedgerSnapshot(decrypted.payloadBytes),
  );
  const databaseName = `nexora-recovery-${dependencies.createId()}`;
  let ledger: IndexedDbLedger | undefined;
  try {
    ledger = await dependencies.createTemporaryLedger(databaseName);
    await ledger.repository.replacePortableSnapshot(snapshot);
    const restoredTransactions = (await ledger.repository.listTransactions()).length;
    return {
      kind: "portable-ledger",
      schemaVersion: decrypted.manifest.schemaVersion,
      createdAt: decrypted.manifest.createdAt,
      restoredTransactions,
    };
  } finally {
    await ledger?.close();
    await dependencies.deleteTemporaryLedger(databaseName);
  }
}

const defaultTemporaryRestoreDependencies: TemporaryRestoreDependencies = {
  createTemporaryLedger: (databaseName) => openIndexedDbLedger({ databaseName }),
  deleteTemporaryLedger: (databaseName) =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Temporary recovery cleanup failed."));
      request.onblocked = () => reject(new Error("Temporary recovery cleanup was blocked."));
    }),
  createId: () => crypto.randomUUID(),
};
