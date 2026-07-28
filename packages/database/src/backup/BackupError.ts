export type BackupErrorCode =
  "backup_failed" | "invalid_archive" | "restore_failed" | "unsupported_backup";

export class BackupError extends Error {
  public readonly code: BackupErrorCode;

  public constructor(code: BackupErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "BackupError";
    this.code = code;
  }
}
