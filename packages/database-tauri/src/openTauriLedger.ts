import type { LedgerRepository } from "@nexora/domain";
import {
  capturePortableLedgerSnapshot,
  createEncryptedPayloadBackup,
  decodePortableLedgerSnapshot,
  decryptEncryptedPayloadBackup,
  encodePortableLedgerSnapshot,
  initializeSqliteLedger,
  PersistenceError,
  sha256Hex,
  validatePortableLedgerSnapshot,
  type InitializedSqliteLedger,
  type Ledger,
  type CreatedLocalBackup,
  type SqliteLedgerRepository,
} from "@nexora/database";

import { TauriSqliteDatabase, type TauriSqlClient } from "./TauriSqliteDatabase";

const defaultDatabaseUrl = "sqlite:nexora.db";
const databaseUrlPattern = /^sqlite:[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export interface NativeLedger extends Ledger {
  readonly database: TauriSqliteDatabase;
  readonly storageKind: "native-sqlite";
}

export interface OpenTauriLedgerOptions {
  readonly databaseUrl?: string;
  readonly loadDatabase?: (databaseUrl: string) => Promise<TauriSqlClient>;
  readonly initializeLedger?: (options: {
    readonly database: TauriSqliteDatabase;
    readonly now?: () => Date;
  }) => Promise<InitializedSqliteLedger>;
  readonly now?: () => Date;
}

export async function openTauriLedger(options: OpenTauriLedgerOptions = {}): Promise<NativeLedger> {
  const databaseUrl = options.databaseUrl ?? defaultDatabaseUrl;
  if (!databaseUrlPattern.test(databaseUrl)) {
    throw new PersistenceError(
      "database_operation_failed",
      "The native SQLite database name is invalid.",
    );
  }

  let database: TauriSqliteDatabase | undefined;
  try {
    const client = await (options.loadDatabase ?? loadNativeDatabase)(databaseUrl);
    database = new TauriSqliteDatabase(client);
    const initialized = await (options.initializeLedger ?? initializeSqliteLedger)({
      database,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    const openedDatabase = database;
    const schemaVersion = initialized.migration.toVersion;

    return {
      database,
      repository: initialized.repository,
      schemaVersion,
      storageKind: "native-sqlite",
      createEncryptedBackupArchive: ({ passphrase }) =>
        createPortableArchive(initialized.repository, schemaVersion, passphrase),
      restoreEncryptedBackupArchive: ({ archive, passphrase }) =>
        restorePortableArchive(initialized.repository, schemaVersion, archive, passphrase),
      verifyEncryptedBackupArchive: ({ archive, passphrase }) =>
        verifyPortableArchive(archive, passphrase),
      close: () => openedDatabase.close(),
    };
  } catch (cause) {
    await database?.close().catch(() => undefined);
    if (cause instanceof PersistenceError || cause instanceof Error) throw cause;
    throw new PersistenceError(
      "database_operation_failed",
      "The native SQLite ledger could not be opened.",
      cause,
    );
  }
}

async function loadNativeDatabase(databaseUrl: string): Promise<TauriSqlClient> {
  try {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    return (await Database.load(databaseUrl)) as TauriSqlClient;
  } catch (cause) {
    throw new PersistenceError(
      "native_sqlite_unavailable",
      "The Tauri native SQLite connection could not be opened.",
      cause,
    );
  }
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
  return {
    id: `nexora-portable-${crypto.randomUUID()}.nexora-backup`,
    archive,
    checksumSha256,
    createdAt,
    size: archive.byteLength,
    manifest: {
      formatVersion: 1 as const,
      schemaVersion,
      createdAt,
      files: [
        { path: "ledger.json", sha256: await sha256Hex(payload), size: payload.byteLength },
      ] as const,
    },
  };
}

async function restorePortableArchive(
  repository: SqliteLedgerRepository,
  schemaVersion: number,
  archive: Uint8Array,
  passphrase: string,
): Promise<void> {
  const decrypted = await decryptEncryptedPayloadBackup(archive, passphrase);
  if (decrypted.manifest.files[0]?.path !== "ledger.json") {
    throw new PersistenceError("corrupt_record", "The native backup payload is invalid.");
  }
  if (decrypted.manifest.schemaVersion > schemaVersion) {
    throw new PersistenceError(
      "corrupt_record",
      "The backup schema is newer than this native ledger.",
    );
  }
  await repository.replacePortableSnapshot(
    validatePortableLedgerSnapshot(decodePortableLedgerSnapshot(decrypted.payloadBytes)),
  );
}

async function verifyPortableArchive(archive: Uint8Array, passphrase: string): Promise<void> {
  const decrypted = await decryptEncryptedPayloadBackup(archive, passphrase);
  if (decrypted.manifest.files[0]?.path !== "ledger.json") {
    throw new PersistenceError("corrupt_record", "The native backup payload is invalid.");
  }
  validatePortableLedgerSnapshot(decodePortableLedgerSnapshot(decrypted.payloadBytes));
}
