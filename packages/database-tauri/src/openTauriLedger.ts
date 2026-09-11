import {
  initializeSqliteLedger,
  PersistenceError,
  PortableBackupEngine,
  type InitializedSqliteLedger,
  type Ledger,
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
    const backupEngine = new PortableBackupEngine({
      repository: initialized.repository,
      schemaVersion,
    });

    return {
      database,
      repository: initialized.repository,
      schemaVersion,
      storageKind: "native-sqlite",
      createEncryptedBackupArchive: ({ passphrase }) => backupEngine.createBackup(passphrase),
      restoreEncryptedBackupArchive: ({ archive, passphrase }) =>
        backupEngine.restoreBackup(archive, passphrase),
      verifyEncryptedBackupArchive: ({ archive, passphrase }) =>
        backupEngine.verifyBackup(archive, passphrase),
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
    const database = (await Database.load(databaseUrl)) as TauriSqlClient;
    const { invoke } = await import("@tauri-apps/api/core");
    const client = adaptTauriDatabase(database);
    return {
      ...client,
      beginTransaction: () => invoke<string>("nexora_sql_begin_transaction", { databaseUrl }),
      transactionExecute: (transactionId, sql, parameters = []) =>
        invoke("nexora_sql_transaction_execute", { transactionId, sql, parameters }),
      transactionSelect: (transactionId, sql, parameters = []) =>
        invoke("nexora_sql_transaction_select", { transactionId, sql, parameters }),
      commitTransaction: (transactionId) =>
        invoke("nexora_sql_commit_transaction", { transactionId }),
      rollbackTransaction: (transactionId) =>
        invoke("nexora_sql_rollback_transaction", { transactionId }),
    };
  } catch (cause) {
    throw new PersistenceError(
      "native_sqlite_unavailable",
      "The Tauri native SQLite connection could not be opened.",
      cause,
    );
  }
}

/** Preserve methods defined on the SQL plugin instance prototype when adapting it across IPC. */
export function adaptTauriDatabase(database: TauriSqlClient): TauriSqlClient {
  return {
    execute: (sql, parameters) => database.execute(sql, parameters),
    select: (sql, parameters) => database.select(sql, parameters),
    close: () => database.close(),
  };
}
