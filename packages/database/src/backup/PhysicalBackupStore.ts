import { BACKUP_FILE_EXTENSION } from "./EncryptedSqliteBackup";
import { BackupError } from "./BackupError";

export interface PhysicalBackupStore {
  write(id: string, archive: Uint8Array): Promise<void>;
  read(id: string): Promise<Uint8Array>;
}

const backupIdPattern = /^[A-Za-z0-9._-]+$/;

export function validateBackupId(id: string): void {
  if (
    typeof id !== "string" ||
    id.length < BACKUP_FILE_EXTENSION.length + 1 ||
    id.length > 128 ||
    !backupIdPattern.test(id) ||
    !id.endsWith(BACKUP_FILE_EXTENSION) ||
    id.includes("..")
  ) {
    throw new BackupError("invalid_archive", "The backup identifier is invalid.");
  }
}
