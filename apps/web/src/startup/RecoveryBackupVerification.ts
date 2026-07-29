import {
  decodePortableLedgerSnapshot,
  decryptEncryptedPayloadBackup,
  validatePortableLedgerSnapshot,
} from "@nexora/database";

export interface VerifiedRecoveryBackup {
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly kind: "portable-ledger" | "sqlite";
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
