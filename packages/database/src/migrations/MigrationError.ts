export type MigrationErrorCode =
  | "applied_migration_mismatch"
  | "backup_failed"
  | "backup_required"
  | "invalid_migration_catalog"
  | "invalid_migration_history"
  | "migration_failed"
  | "migration_in_progress"
  | "unknown_database_version";

export class MigrationError extends Error {
  public readonly code: MigrationErrorCode;

  public constructor(code: MigrationErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "MigrationError";
    this.code = code;
  }
}
