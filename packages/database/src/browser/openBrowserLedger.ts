import type { LedgerRepository } from "@nexora/domain";

import {
  openIndexedDbLedger,
  type IndexedDbLedger,
  type OpenIndexedDbLedgerOptions,
} from "../indexeddb/openIndexedDbLedger";
import { isOpfsSqliteSupported } from "../opfs/OpfsSqliteDatabase";
import {
  openOpfsLedger,
  type OpenOpfsLedgerOptions,
  type OpfsLedger,
} from "../opfs/openOpfsLedger";
import { PersistenceError } from "../sqlite/PersistenceError";
import {
  LocalSqliteBackupService,
  type CreatedLocalBackup,
} from "../backup/LocalSqliteBackupService";
import { FileSystemDirectoryBackupStore } from "../backup/PhysicalBackupStore";

export type BrowserLedgerStorageKind = "opfs" | "indexeddb";

export interface BrowserLedger {
  readonly repository: LedgerRepository;
  readonly schemaVersion: number;
  readonly storageKind: BrowserLedgerStorageKind;
  createEncryptedBackup?(input: {
    readonly directory: FileSystemDirectoryHandle;
    readonly passphrase: string;
  }): Promise<CreatedLocalBackup>;
  restoreEncryptedBackup?(input: {
    readonly directory: FileSystemDirectoryHandle;
    readonly id: string;
    readonly passphrase: string;
  }): Promise<void>;
  close(): Promise<void>;
}

export interface OpenBrowserLedgerOptions {
  readonly preferredStorageKind?: BrowserLedgerStorageKind;
  readonly opfs?: OpenOpfsLedgerOptions;
  readonly indexedDb?: OpenIndexedDbLedgerOptions;
}

export interface BrowserLedgerOpeners {
  isOpfsSupported(): boolean;
  openOpfs(options?: OpenOpfsLedgerOptions): Promise<OpfsLedger>;
  openIndexedDb(options?: OpenIndexedDbLedgerOptions): Promise<IndexedDbLedger>;
}

const defaultOpeners: BrowserLedgerOpeners = {
  isOpfsSupported: isOpfsSqliteSupported,
  openOpfs: openOpfsLedger,
  openIndexedDb: openIndexedDbLedger,
};

export async function openBrowserLedger(
  options: OpenBrowserLedgerOptions = {},
  openers: BrowserLedgerOpeners = defaultOpeners,
): Promise<BrowserLedger> {
  if (options.preferredStorageKind === "indexeddb") {
    return fromIndexedDbLedger(await openers.openIndexedDb(options.indexedDb));
  }

  if (options.preferredStorageKind === "opfs") {
    if (!openers.isOpfsSupported()) {
      throw new PersistenceError(
        "opfs_unavailable",
        "The previously selected SQLite OPFS ledger is unavailable in this browser context.",
      );
    }
    return fromOpfsLedger(await openers.openOpfs(options.opfs));
  }

  if (openers.isOpfsSupported()) {
    try {
      return fromOpfsLedger(await openers.openOpfs(options.opfs));
    } catch (cause) {
      if (!(cause instanceof PersistenceError) || cause.code !== "opfs_unavailable") {
        throw cause;
      }
    }
  }

  return fromIndexedDbLedger(await openers.openIndexedDb(options.indexedDb));
}

function fromOpfsLedger(ledger: OpfsLedger): BrowserLedger {
  return {
    repository: ledger.repository,
    schemaVersion: ledger.migration.toVersion,
    storageKind: "opfs",
    createEncryptedBackup: ({ directory, passphrase }) =>
      createBackupService(ledger, directory, passphrase).createBackup(),
    restoreEncryptedBackup: async ({ directory, id, passphrase }) => {
      await createBackupService(ledger, directory, passphrase).restoreBackup(id);
    },
    close: () => ledger.close(),
  };
}

function createBackupService(
  ledger: OpfsLedger,
  directory: FileSystemDirectoryHandle,
  passphrase: string,
): LocalSqliteBackupService {
  return new LocalSqliteBackupService({
    database: ledger.database,
    store: new FileSystemDirectoryBackupStore(directory),
    passphrase,
  });
}

function fromIndexedDbLedger(ledger: IndexedDbLedger): BrowserLedger {
  return {
    repository: ledger.repository,
    schemaVersion: ledger.schemaVersion,
    storageKind: "indexeddb",
    close: () => ledger.close(),
  };
}
