import { databaseMigrations } from "../migrations/0001-initial-ledger-schema";
import type { MigrationBackupProvider } from "../migrations/MigrationBackup";
import { MigrationRunner, type MigrationRunResult } from "../migrations/MigrationRunner";
import type { SqliteDatabase } from "./SqliteDatabase";
import { SqliteLedgerRepository } from "./SqliteLedgerRepository";

export interface InitializeSqliteLedgerOptions {
  readonly database: SqliteDatabase;
  readonly backupProvider?: MigrationBackupProvider;
  readonly now?: () => Date;
}

export interface InitializedSqliteLedger {
  readonly repository: SqliteLedgerRepository;
  readonly migration: MigrationRunResult;
}

export async function initializeSqliteLedger(
  options: InitializeSqliteLedgerOptions,
): Promise<InitializedSqliteLedger> {
  const runner = new MigrationRunner({
    database: options.database,
    migrations: databaseMigrations,
    ...(options.backupProvider === undefined ? {} : { backupProvider: options.backupProvider }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const migration = await runner.migrateToLatest();

  return {
    repository: new SqliteLedgerRepository(options.database),
    migration,
  };
}
