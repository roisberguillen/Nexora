export type PersistenceErrorCode =
  | "corrupt_record"
  | "database_operation_failed"
  | "indexeddb_unavailable"
  | "opfs_unavailable"
  | "persistence_closed"
  | "restore_failed"
  | "upgrade_blocked"
  | "worker_failed";

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;

  public constructor(code: PersistenceErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PersistenceError";
    this.code = code;
  }
}
