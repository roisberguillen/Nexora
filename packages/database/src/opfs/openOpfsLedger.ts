import type { MigrationBackupProvider } from "../migrations/MigrationBackup";
import type { MigrationRunResult } from "../migrations/MigrationRunner";
import type { PhysicalSqliteDatabase } from "../sqlite/SqliteDatabase";
import type { SqliteLedgerRepository } from "../sqlite/SqliteLedgerRepository";
import { initializeSqliteLedger } from "../sqlite/initializeSqliteLedger";
import { PersistenceError } from "../sqlite/PersistenceError";
import { openOpfsSqliteDatabase, type OpenOpfsSqliteDatabaseOptions } from "./OpfsSqliteDatabase";

export interface OpenOpfsLedgerOptions extends OpenOpfsSqliteDatabaseOptions {
  readonly backupProvider?: MigrationBackupProvider;
  readonly backupProviderFactory?: (database: PhysicalSqliteDatabase) => MigrationBackupProvider;
  readonly now?: () => Date;
}

export interface OpfsLedger {
  readonly database: PhysicalSqliteDatabase;
  readonly repository: SqliteLedgerRepository;
  readonly migration: MigrationRunResult;
  close(): Promise<void>;
}

export async function openOpfsLedger(options: OpenOpfsLedgerOptions = {}): Promise<OpfsLedger> {
  const database = await openOpfsSqliteDatabase({
    ...(options.filename === undefined ? {} : { filename: options.filename }),
    ...(options.requestTimeoutMs === undefined
      ? {}
      : { requestTimeoutMs: options.requestTimeoutMs }),
  });

  try {
    if (options.backupProvider !== undefined && options.backupProviderFactory !== undefined) {
      throw new PersistenceError(
        "database_operation_failed",
        "Only one OPFS migration backup provider strategy may be configured.",
      );
    }
    const backupProvider = options.backupProvider ?? options.backupProviderFactory?.(database);
    const ledger = await initializeSqliteLedger({
      database,
      ...(backupProvider === undefined ? {} : { backupProvider }),
      ...(options.now === undefined ? {} : { now: options.now }),
    });

    return {
      database,
      repository: ledger.repository,
      migration: ledger.migration,
      close: () => database.close(),
    };
  } catch (cause) {
    await database.close();
    throw cause;
  }
}
