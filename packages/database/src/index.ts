export { InMemoryLedgerRepository } from "./in-memory/InMemoryLedgerRepository";
export { BackupError, type BackupErrorCode } from "./backup/BackupError";
export {
  BACKUP_FILE_EXTENSION,
  BACKUP_FORMAT_VERSION,
  createEncryptedSqliteBackup,
  decryptSqliteBackup,
  PBKDF2_ITERATIONS,
  sha256Hex,
  type BackupManifest,
  type BackupManifestFile,
  type CreateEncryptedSqliteBackupOptions,
  type DecryptedSqliteBackup,
} from "./backup/EncryptedSqliteBackup";
export {
  LocalSqliteBackupService,
  type CreatedLocalBackup,
  type LocalSqliteBackupServiceOptions,
  type RestoredLocalBackup,
} from "./backup/LocalSqliteBackupService";
export {
  FileSystemDirectoryBackupStore,
  type PhysicalBackupStore,
} from "./backup/PhysicalBackupStore";
export {
  openBrowserLedger,
  type BrowserLedger,
  type BrowserLedgerOpeners,
  type BrowserLedgerStorageKind,
  type OpenBrowserLedgerOptions,
} from "./browser/openBrowserLedger";
export { IndexedDbLedgerRepository } from "./indexeddb/IndexedDbLedgerRepository";
export {
  INDEXED_DB_SCHEMA_VERSION,
  isIndexedDbSupported,
  openIndexedDbLedger,
  type IndexedDbLedger,
  type OpenIndexedDbLedgerOptions,
} from "./indexeddb/openIndexedDbLedger";
export {
  isOpfsSqliteSupported,
  openOpfsSqliteDatabase,
  type OpenOpfsSqliteDatabaseOptions,
} from "./opfs/OpfsSqliteDatabase";
export { openOpfsLedger, type OpfsLedger, type OpenOpfsLedgerOptions } from "./opfs/openOpfsLedger";
export {
  databaseMigrations,
  INITIAL_LEDGER_SCHEMA_VERSION,
  initialLedgerSchemaMigration,
  requiredSqlitePragmas,
} from "./migrations/0001-initial-ledger-schema";
export {
  TRANSACTION_SPLITS_SCHEMA_VERSION,
  transactionSplitsMigration,
} from "./migrations/0002-transaction-splits";
export { TAGS_SCHEMA_VERSION, tagsMigration } from "./migrations/0003-tags";
export {
  IMPORT_BATCHES_SCHEMA_VERSION,
  importBatchesMigration,
} from "./migrations/0004-import-batches";
export {
  RECURRING_RULES_SCHEMA_VERSION,
  recurringRulesMigration,
} from "./migrations/0005-recurring-rules";
export {
  ALLOCATION_PLANS_SCHEMA_VERSION,
  allocationPlansMigration,
} from "./migrations/0006-allocation-plans";
export { BUDGETS_SCHEMA_VERSION, budgetsMigration } from "./migrations/0007-budgets";
export type { DatabaseMigration } from "./migrations/DatabaseMigration";
export type {
  MigrationBackupProvider,
  MigrationBackupRequest,
  VerifiedMigrationBackup,
} from "./migrations/MigrationBackup";
export { MigrationError, type MigrationErrorCode } from "./migrations/MigrationError";
export {
  MigrationRunner,
  type MigrationRunnerOptions,
  type MigrationRunResult,
} from "./migrations/MigrationRunner";
export { PersistenceError, type PersistenceErrorCode } from "./sqlite/PersistenceError";
export type {
  CloseableSqliteDatabase,
  PhysicalSqliteDatabase,
  SqliteDatabase,
  SqliteValue,
} from "./sqlite/SqliteDatabase";
export { SqliteLedgerRepository } from "./sqlite/SqliteLedgerRepository";
export {
  initializeSqliteLedger,
  type InitializedSqliteLedger,
  type InitializeSqliteLedgerOptions,
} from "./sqlite/initializeSqliteLedger";
export { DemoSeedError, type DemoSeedErrorCode } from "./seed/DemoSeedError";
export {
  createDemoLedgerSeed,
  DEMO_LEDGER_SEED_VERSION,
  seedDemoLedger,
  type DemoLedgerSeed,
  type DemoSeedEntityCounts,
  type DemoSeedResult,
  type DemoSeedStatus,
} from "./seed/demoLedgerSeed";
