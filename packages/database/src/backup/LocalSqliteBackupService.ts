import type {
  MigrationBackupProvider,
  MigrationBackupRequest,
  VerifiedMigrationBackup,
} from "../migrations/MigrationBackup";
import { databaseMigrations } from "../migrations/0001-initial-ledger-schema";
import type { PhysicalSqliteDatabase } from "../sqlite/SqliteDatabase";
import { BackupError } from "./BackupError";
import {
  BACKUP_FILE_EXTENSION,
  type BackupManifest,
  createEncryptedSqliteBackup,
  decryptSqliteBackup,
  sha256Hex,
} from "./EncryptedSqliteBackup";
import type { PhysicalBackupStore } from "./PhysicalBackupStore";
import { validateBackupId } from "./PhysicalBackupStore";

export interface LocalSqliteBackupServiceOptions {
  readonly database: PhysicalSqliteDatabase;
  readonly store: PhysicalBackupStore;
  readonly passphrase: string;
  readonly appVersion?: string;
  readonly now?: () => Date;
  readonly idFactory?: () => string;
  readonly cryptoProvider?: Crypto;
  readonly maxSupportedSchemaVersion?: number;
}

export interface CreatedLocalBackup extends VerifiedMigrationBackup {
  readonly manifest: BackupManifest;
  readonly size: number;
}

export interface RestoredLocalBackup {
  readonly id: string;
  readonly checksumSha256: string;
  readonly schemaVersion: number;
  readonly restoredAt: string;
}

export class LocalSqliteBackupService implements MigrationBackupProvider {
  private readonly database: PhysicalSqliteDatabase;
  private readonly store: PhysicalBackupStore;
  private readonly passphrase: string;
  private readonly appVersion: string | undefined;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly cryptoProvider: Crypto;
  private readonly maxSupportedSchemaVersion: number;
  private operationTail: Promise<void> = Promise.resolve();

  public constructor(options: LocalSqliteBackupServiceOptions) {
    this.database = options.database;
    this.store = options.store;
    this.passphrase = options.passphrase;
    this.appVersion = options.appVersion;
    this.now = options.now ?? (() => new Date());
    this.cryptoProvider = options.cryptoProvider ?? globalThis.crypto;
    this.idFactory = options.idFactory ?? (() => this.cryptoProvider.randomUUID());
    this.maxSupportedSchemaVersion =
      options.maxSupportedSchemaVersion ?? databaseMigrations.at(-1)?.version ?? 0;
    if (!Number.isInteger(this.maxSupportedSchemaVersion) || this.maxSupportedSchemaVersion < 0) {
      throw new BackupError("backup_failed", "The supported backup schema version is invalid.");
    }
  }

  public createBackup(): Promise<CreatedLocalBackup> {
    return this.enqueue(() => this.createBackupInternal());
  }

  public createVerifiedBackup(request: MigrationBackupRequest): Promise<VerifiedMigrationBackup> {
    return this.enqueue(async () => {
      const schemaVersion = await this.readSchemaVersion();
      if (schemaVersion !== request.fromVersion) {
        throw new BackupError(
          "backup_failed",
          "The migration backup source version does not match the open database.",
        );
      }
      const backup = await this.createBackupInternal(schemaVersion);
      return {
        id: backup.id,
        createdAt: backup.createdAt,
        checksumSha256: backup.checksumSha256,
      };
    });
  }

  public restoreBackup(id: string, expectedChecksumSha256?: string): Promise<RestoredLocalBackup> {
    return this.enqueue(async () => {
      validateBackupId(id);
      const archive = await this.store.read(id);
      const archiveChecksum = await sha256Hex(archive, this.cryptoProvider);
      if (
        expectedChecksumSha256 !== undefined &&
        archiveChecksum !== expectedChecksumSha256.toLowerCase()
      ) {
        throw new BackupError(
          "invalid_archive",
          "The encrypted backup checksum does not match the selected receipt.",
        );
      }

      const decrypted = await decryptSqliteBackup(archive, this.passphrase, this.cryptoProvider);
      if (decrypted.manifest.schemaVersion > this.maxSupportedSchemaVersion) {
        throw new BackupError(
          "unsupported_backup",
          "The backup was created by a newer Nexora database schema.",
        );
      }

      try {
        await this.database.restoreDatabase(
          decrypted.databaseBytes,
          decrypted.manifest.schemaVersion,
        );
        await this.assertDatabaseHealth();
        const restoredSchemaVersion = await this.readSchemaVersion();
        if (restoredSchemaVersion !== decrypted.manifest.schemaVersion) {
          throw new BackupError(
            "restore_failed",
            "The restored database schema does not match the backup manifest.",
          );
        }
      } catch (cause) {
        if (cause instanceof BackupError && cause.code === "restore_failed") {
          throw cause;
        }
        throw new BackupError("restore_failed", "The SQLite backup could not be restored.", cause);
      }

      return {
        id,
        checksumSha256: archiveChecksum,
        schemaVersion: decrypted.manifest.schemaVersion,
        restoredAt: timestamp(this.now()),
      };
    });
  }

  private async createBackupInternal(knownSchemaVersion?: number): Promise<CreatedLocalBackup> {
    try {
      await this.assertDatabaseHealth();
      const schemaVersion = knownSchemaVersion ?? (await this.readSchemaVersion());
      if (schemaVersion > this.maxSupportedSchemaVersion) {
        throw new BackupError(
          "unsupported_backup",
          "The open database schema is newer than this backup provider.",
        );
      }
      const createdAt = timestamp(this.now());
      const databaseBytes = await this.database.exportDatabase();
      const archive = await createEncryptedSqliteBackup({
        databaseBytes,
        schemaVersion,
        createdAt,
        passphrase: this.passphrase,
        ...(this.appVersion === undefined ? {} : { appVersion: this.appVersion }),
        cryptoProvider: this.cryptoProvider,
      });
      const id = this.createBackupId(schemaVersion, createdAt);
      const expectedChecksum = await sha256Hex(archive, this.cryptoProvider);

      await this.store.write(id, archive);
      const persistedArchive = await this.store.read(id);
      const persistedChecksum = await sha256Hex(persistedArchive, this.cryptoProvider);
      if (persistedChecksum !== expectedChecksum) {
        throw new BackupError(
          "backup_failed",
          "The persisted backup checksum does not match the generated archive.",
        );
      }
      const verified = await decryptSqliteBackup(
        persistedArchive,
        this.passphrase,
        this.cryptoProvider,
      );
      if (verified.manifest.schemaVersion !== schemaVersion) {
        throw new BackupError(
          "backup_failed",
          "The persisted backup schema version could not be verified.",
        );
      }

      return {
        id,
        createdAt,
        checksumSha256: persistedChecksum,
        manifest: verified.manifest,
        size: persistedArchive.byteLength,
      };
    } catch (cause) {
      if (cause instanceof BackupError) {
        throw cause;
      }
      throw new BackupError(
        "backup_failed",
        "The encrypted SQLite backup could not be created.",
        cause,
      );
    }
  }

  private async assertDatabaseHealth(): Promise<void> {
    const integrityRows = await this.database.query<{ readonly integrity_check: unknown }>(
      "PRAGMA integrity_check;",
    );
    if (integrityRows.length !== 1 || integrityRows[0]?.integrity_check !== "ok") {
      throw new BackupError("backup_failed", "The SQLite integrity check failed.");
    }
    const foreignKeyRows = await this.database.query<Record<string, unknown>>(
      "PRAGMA foreign_key_check;",
    );
    if (foreignKeyRows.length > 0) {
      throw new BackupError("backup_failed", "The SQLite foreign key check failed.");
    }
  }

  private async readSchemaVersion(): Promise<number> {
    const tableRows = await this.database.query<{ readonly name: unknown }>(
      `
        SELECT name
        FROM sqlite_schema
        WHERE type = 'table' AND name = 'schema_migrations'
      `,
    );
    if (tableRows.length === 0) {
      return 0;
    }
    const versionRows = await this.database.query<{ readonly version: unknown }>(
      "SELECT MAX(version) AS version FROM schema_migrations;",
    );
    const version = versionRows[0]?.version;
    if (!Number.isInteger(version) || (version as number) < 0) {
      throw new BackupError("backup_failed", "The SQLite schema version could not be determined.");
    }
    return version as number;
  }

  private createBackupId(schemaVersion: number, createdAt: string): string {
    const suffix = this.idFactory();
    if (
      typeof suffix !== "string" ||
      suffix.length < 1 ||
      suffix.length > 64 ||
      !/^[A-Za-z0-9-]+$/.test(suffix)
    ) {
      throw new BackupError(
        "backup_failed",
        "The backup identifier factory returned an invalid value.",
      );
    }
    const compactTimestamp = createdAt.replaceAll(/[-:.]/g, "");
    const id = `nexora-v${schemaVersion}-${compactTimestamp}-${suffix}` + BACKUP_FILE_EXTENSION;
    validateBackupId(id);
    return id;
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function timestamp(value: Date): string {
  if (!Number.isFinite(value.getTime())) {
    throw new BackupError("backup_failed", "The backup clock returned an invalid timestamp.");
  }
  return value.toISOString();
}
