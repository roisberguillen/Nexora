import type { LedgerRepository } from "@nexora/domain";

import type { CreatedPortableBackup } from "./backup/PortableBackupEngine";

export type LedgerStorageKind = "opfs" | "indexeddb" | "native-sqlite";

/** Platform-neutral ledger handle consumed by the shared React application. */
export interface Ledger {
  readonly repository: LedgerRepository;
  readonly schemaVersion: number;
  readonly storageKind: LedgerStorageKind;
  createEncryptedBackupArchive?(input: {
    readonly passphrase: string;
  }): Promise<CreatedPortableBackup>;
  restoreEncryptedBackupArchive?(input: {
    readonly archive: Uint8Array;
    readonly id: string;
    readonly passphrase: string;
  }): Promise<void>;
  verifyEncryptedBackupArchive?(input: {
    readonly archive: Uint8Array;
    readonly passphrase: string;
  }): Promise<void>;
  close(): Promise<void>;
}
