import { BACKUP_FILE_EXTENSION } from "./EncryptedSqliteBackup";
import { BackupError } from "./BackupError";

export interface PhysicalBackupStore {
  write(id: string, archive: Uint8Array): Promise<void>;
  read(id: string): Promise<Uint8Array>;
}

const backupIdPattern = /^[A-Za-z0-9._-]+$/;
const maxArchiveBytes = 512 * 1024 * 1024 + 128 * 1024;

export class FileSystemDirectoryBackupStore implements PhysicalBackupStore {
  public constructor(private readonly directory: FileSystemDirectoryHandle) {}

  public async write(id: string, archive: Uint8Array): Promise<void> {
    validateBackupId(id);
    validateArchive(archive);

    try {
      const fileHandle = await this.directory.getFileHandle(id, { create: true });
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(toArrayBuffer(archive));
        await writable.close();
      } catch (cause) {
        try {
          await writable.abort(cause);
        } catch {
          // The original write error remains the actionable failure.
        }
        throw cause;
      }
    } catch (cause) {
      throw new BackupError(
        "backup_failed",
        "The encrypted backup could not be written to the selected directory.",
        cause,
      );
    }
  }

  public async read(id: string): Promise<Uint8Array> {
    validateBackupId(id);

    try {
      const fileHandle = await this.directory.getFileHandle(id);
      const file = await fileHandle.getFile();
      if (file.size < 1 || file.size > maxArchiveBytes) {
        throw new BackupError("invalid_archive", "The stored backup size is invalid.");
      }
      return new Uint8Array(await file.arrayBuffer());
    } catch (cause) {
      if (cause instanceof BackupError) {
        throw cause;
      }
      throw new BackupError(
        "invalid_archive",
        "The encrypted backup could not be read from the selected directory.",
        cause,
      );
    }
  }
}

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

function validateArchive(archive: Uint8Array): void {
  if (
    !(archive instanceof Uint8Array) ||
    archive.byteLength < 1 ||
    archive.byteLength > maxArchiveBytes
  ) {
    throw new BackupError("backup_failed", "The encrypted backup size is invalid.");
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
