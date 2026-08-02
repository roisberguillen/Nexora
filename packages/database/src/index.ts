export { InMemoryLedgerRepository } from "./in-memory/InMemoryLedgerRepository";
export type { Ledger, LedgerStorageKind } from "./Ledger";
export { BackupError, type BackupErrorCode } from "./backup/BackupError";
export {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  PORTABLE_LEDGER_SNAPSHOT_VERSION,
  type PortableLedgerSnapshot,
  validatePortableLedgerSnapshot,
  type ValidatedPortableLedgerSnapshot,
} from "./backup/PortableLedgerSnapshot";
export {
  BACKUP_FILE_EXTENSION,
  BACKUP_FORMAT_VERSION,
  createEncryptedSqliteBackup,
  createEncryptedPayloadBackup,
  decryptEncryptedPayloadBackup,
  decryptSqliteBackup,
  PBKDF2_ITERATIONS,
  sha256Hex,
  type BackupManifest,
  type BackupManifestFile,
  type CreateEncryptedSqliteBackupOptions,
  type DecryptedSqliteBackup,
  type CreateEncryptedPayloadBackupOptions,
  type DecryptedBackupPayload,
} from "./backup/EncryptedSqliteBackup";
export {
  LocalSqliteBackupService,
  type CreatedLocalBackup,
  type LocalSqliteBackupServiceOptions,
  type RestoredLocalBackup,
} from "./backup/LocalSqliteBackupService";
export type { PhysicalBackupStore } from "./backup/PhysicalBackupStore";
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
export { LOANS_SCHEMA_VERSION, loansMigration } from "./migrations/0008-loans";
export {
  INVESTMENT_POSITIONS_SCHEMA_VERSION,
  investmentPositionsMigration,
} from "./migrations/0009-investment-positions";
export {
  BANK_IMPORTER_TYPES_SCHEMA_VERSION,
  bankImporterTypesMigration,
} from "./migrations/0010-bank-importer-types";
export {
  TRANSACTION_TRASH_SCHEMA_VERSION,
  transactionTrashMigration,
} from "./migrations/0012-transaction-trash";
export {
  IMPORT_ROW_DELETION_AUDIT_SCHEMA_VERSION,
  importRowDeletionAuditMigration,
} from "./migrations/0013-import-row-deletion-audit";
export {
  IMPORT_MAPPING_PROFILES_SCHEMA_VERSION,
  importMappingProfilesMigration,
} from "./migrations/0014-import-mapping-profiles";
export {
  GENERIC_CSV_IMPORTER_SCHEMA_VERSION,
  genericCsvImporterMigration,
} from "./migrations/0015-generic-csv-importer";
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
