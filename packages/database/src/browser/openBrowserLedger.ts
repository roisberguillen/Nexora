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
import { LocalSqliteBackupService } from "../backup/LocalSqliteBackupService";
import { BackupError } from "../backup/BackupError";
import { PortableBackupEngine } from "../backup/PortableBackupEngine";
import { type PhysicalBackupStore } from "../backup/PhysicalBackupStore";
import type { Ledger } from "../Ledger";

export type BrowserLedgerStorageKind = "opfs" | "indexeddb";

export interface BrowserLedger extends Ledger {
  readonly storageKind: BrowserLedgerStorageKind;
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
  const backupEngine = new PortableBackupEngine({
    repository: ledger.repository,
    schemaVersion: ledger.migration.toVersion,
  });
  return {
    repository: ledger.repository,
    schemaVersion: ledger.migration.toVersion,
    storageKind: "opfs",
    createEncryptedBackupArchive: ({ passphrase }) => backupEngine.createBackup(passphrase),
    restoreEncryptedBackupArchive: async ({ archive, id, passphrase }) => {
      try {
        await backupEngine.restoreBackup(archive, passphrase);
      } catch (cause) {
        if (!(cause instanceof BackupError) || cause.code !== "unsupported_backup") throw cause;
        const store = new MemoryBackupStore();
        await store.write(id, archive);
        await createBackupService(ledger, store, passphrase).restoreBackup(id);
      }
    },
    verifyEncryptedBackupArchive: async ({ archive, passphrase }) => {
      await backupEngine.verifyBackup(archive, passphrase);
    },
    close: () => ledger.close(),
  };
}

function createBackupService(
  ledger: OpfsLedger,
  store: PhysicalBackupStore,
  passphrase: string,
): LocalSqliteBackupService {
  return new LocalSqliteBackupService({
    database: ledger.database,
    store,
    passphrase,
  });
}

class MemoryBackupStore implements PhysicalBackupStore {
  private readonly archives = new Map<string, Uint8Array>();

  public async write(id: string, archive: Uint8Array): Promise<void> {
    const copy = new Uint8Array(archive.byteLength);
    copy.set(archive);
    this.archives.set(id, copy);
  }

  public async read(id: string): Promise<Uint8Array> {
    const archive = this.archives.get(id);
    if (archive === undefined) {
      throw new PersistenceError("corrupt_record", "Encrypted backup not found.");
    }
    const copy = new Uint8Array(archive.byteLength);
    copy.set(archive);
    return copy;
  }
}

function fromIndexedDbLedger(ledger: IndexedDbLedger): BrowserLedger {
  const backupEngine = new PortableBackupEngine({
    repository: ledger.repository,
    schemaVersion: ledger.schemaVersion,
  });
  return {
    repository: ledger.repository,
    schemaVersion: ledger.schemaVersion,
    storageKind: "indexeddb",
    createEncryptedBackupArchive: ({ passphrase }) => backupEngine.createBackup(passphrase),
    restoreEncryptedBackupArchive: async ({ archive, passphrase }) => {
      await backupEngine.restoreBackup(archive, passphrase);
    },
    verifyEncryptedBackupArchive: async ({ archive, passphrase }) => {
      await backupEngine.verifyBackup(archive, passphrase);
    },
    close: () => ledger.close(),
  };
}
