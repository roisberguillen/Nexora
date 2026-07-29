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
import {
  createEncryptedPayloadBackup,
  decryptEncryptedPayloadBackup,
  sha256Hex,
} from "../backup/EncryptedSqliteBackup";
import {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  validatePortableLedgerSnapshot,
} from "../backup/PortableLedgerSnapshot";
import {
  FileSystemDirectoryBackupStore,
  type PhysicalBackupStore,
} from "../backup/PhysicalBackupStore";

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
  createEncryptedBackupArchive?(input: {
    readonly passphrase: string;
  }): Promise<CreatedLocalBackup & { readonly archive: Uint8Array }>;
  restoreEncryptedBackupArchive?(input: {
    readonly archive: Uint8Array;
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
      createBackupService(
        ledger,
        new FileSystemDirectoryBackupStore(directory),
        passphrase,
      ).createBackup(),
    restoreEncryptedBackup: async ({ directory, id, passphrase }) => {
      await createBackupService(
        ledger,
        new FileSystemDirectoryBackupStore(directory),
        passphrase,
      ).restoreBackup(id);
    },
    createEncryptedBackupArchive: async ({ passphrase }) => {
      return createPortableArchive(ledger.repository, ledger.migration.toVersion, passphrase);
    },
    restoreEncryptedBackupArchive: async ({ archive, id, passphrase }) => {
      const decrypted = await decryptEncryptedPayloadBackup(archive, passphrase);
      if (decrypted.manifest.files[0].path === "ledger.json") {
        await ledger.repository.replacePortableSnapshot(
          validatePortableLedgerSnapshot(decodePortableLedgerSnapshot(decrypted.payloadBytes)),
        );
        return;
      }
      const store = new MemoryBackupStore();
      await store.write(id, archive);
      await createBackupService(ledger, store, passphrase).restoreBackup(id);
    },
    close: () => ledger.close(),
  };
}

async function createPortableArchive(
  repository: LedgerRepository,
  schemaVersion: number,
  passphrase: string,
): Promise<CreatedLocalBackup & { readonly archive: Uint8Array }> {
  const createdAt = new Date().toISOString();
  const payload = encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository));
  const archive = await createEncryptedPayloadBackup({
    payloadBytes: payload,
    path: "ledger.json",
    schemaVersion,
    createdAt,
    passphrase,
  });
  const checksumSha256 = await sha256Hex(archive);
  const id = `nexora-portable-${crypto.randomUUID()}.nexora-backup`;
  return {
    id,
    archive,
    checksumSha256,
    createdAt,
    size: archive.byteLength,
    manifest: {
      formatVersion: 1,
      schemaVersion,
      createdAt,
      files: [{ path: "ledger.json", sha256: await sha256Hex(payload), size: payload.byteLength }],
    },
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
  return {
    repository: ledger.repository,
    schemaVersion: ledger.schemaVersion,
    storageKind: "indexeddb",
    createEncryptedBackupArchive: async ({ passphrase }) => {
      return createPortableArchive(ledger.repository, ledger.schemaVersion, passphrase);
    },
    restoreEncryptedBackupArchive: async ({ archive, passphrase }) => {
      const decrypted = await decryptEncryptedPayloadBackup(archive, passphrase);
      if (decrypted.manifest.files[0].path !== "ledger.json") {
        throw new PersistenceError(
          "corrupt_record",
          "The portable IndexedDB backup payload is missing.",
        );
      }
      if (decrypted.manifest.schemaVersion > ledger.schemaVersion) {
        throw new PersistenceError(
          "corrupt_record",
          "The backup schema is newer than this IndexedDB ledger.",
        );
      }
      await ledger.repository.replacePortableSnapshot(
        validatePortableLedgerSnapshot(decodePortableLedgerSnapshot(decrypted.payloadBytes)),
      );
    },
    close: () => ledger.close(),
  };
}
