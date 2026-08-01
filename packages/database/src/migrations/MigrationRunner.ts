import { requiredSqlitePragmas } from "./0001-initial-ledger-schema";
import type { DatabaseMigration } from "./DatabaseMigration";
import type { MigrationBackupProvider, VerifiedMigrationBackup } from "./MigrationBackup";
import { MigrationError } from "./MigrationError";
import type { SqliteDatabase } from "../sqlite/SqliteDatabase";

interface AppliedMigrationRow {
  readonly name: string;
  readonly version: number;
}

export interface MigrationRunnerOptions {
  readonly database: SqliteDatabase;
  readonly migrations: readonly DatabaseMigration[];
  readonly backupProvider?: MigrationBackupProvider;
  readonly now?: () => Date;
}

export interface MigrationRunResult {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly appliedMigrations: readonly number[];
}

const migrationNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sha256Pattern = /^[a-fA-F0-9]{64}$/;

export class MigrationRunner {
  private readonly database: SqliteDatabase;
  private readonly migrations: readonly DatabaseMigration[];
  private readonly backupProvider: MigrationBackupProvider | undefined;
  private readonly now: () => Date;
  private isRunning = false;

  public constructor(options: MigrationRunnerOptions) {
    validateMigrationCatalog(options.migrations);
    this.database = options.database;
    this.migrations = [...options.migrations];
    this.backupProvider = options.backupProvider;
    this.now = options.now ?? (() => new Date());
  }

  public async migrateToLatest(): Promise<MigrationRunResult> {
    if (this.isRunning) {
      throw new MigrationError(
        "migration_in_progress",
        "A migration run is already active on this runner.",
      );
    }

    this.isRunning = true;
    try {
      await this.database.execute(requiredSqlitePragmas);
      const appliedMigrations = await this.readAppliedMigrations();
      validateAppliedMigrations(appliedMigrations, this.migrations);
      await this.repairLegacyMigrations(appliedMigrations);

      const fromVersion = appliedMigrations.at(-1)?.version ?? 0;
      const appliedVersions: number[] = [];

      for (const migration of this.migrations) {
        if (migration.version <= fromVersion) {
          continue;
        }

        if (migration.requiresBackup) {
          await this.createPreventiveBackup(migration, migration.version - 1);
        }

        await this.applyMigration(migration);
        appliedVersions.push(migration.version);
      }

      return {
        fromVersion,
        toVersion: appliedVersions.at(-1) ?? fromVersion,
        appliedMigrations: appliedVersions,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async repairLegacyMigrations(
    appliedMigrations: readonly AppliedMigrationRow[],
  ): Promise<void> {
    const repairs = appliedMigrations
      .map((applied, index) => ({ applied, migration: this.migrations[index] }))
      .filter(
        (
          entry,
        ): entry is {
          applied: AppliedMigrationRow;
          migration: DatabaseMigration;
        } =>
          entry.migration !== undefined &&
          entry.migration.legacyNames?.includes(entry.applied.name) === true,
      );
    if (repairs.length === 0) return;

    await this.database.execute("BEGIN IMMEDIATE;");
    try {
      for (const { applied, migration } of repairs) {
        await migration.legacyRepair?.(this.database);
        await this.database.run("UPDATE schema_migrations SET name = ? WHERE version = ?", [
          migration.name,
          applied.version,
        ]);
      }
      await this.database.execute("COMMIT;");
    } catch (cause) {
      try {
        await this.database.execute("ROLLBACK;");
      } catch {
        // The original repair error remains actionable.
      }
      throw new MigrationError(
        "migration_failed",
        "A legacy migration history could not be repaired safely.",
        cause,
      );
    }
  }

  private async readAppliedMigrations(): Promise<readonly AppliedMigrationRow[]> {
    const schemaTable = await this.database.query<{ readonly name: string }>(
      `
        SELECT name
        FROM sqlite_schema
        WHERE type = 'table' AND name = 'schema_migrations'
      `,
    );

    if (schemaTable.length === 0) {
      return [];
    }

    try {
      return await this.database.query<AppliedMigrationRow>(
        `
          SELECT version, name
          FROM schema_migrations
          ORDER BY version ASC
        `,
      );
    } catch (cause) {
      throw new MigrationError(
        "invalid_migration_history",
        "The migration history table cannot be read.",
        cause,
      );
    }
  }

  private async createPreventiveBackup(
    migration: DatabaseMigration,
    fromVersion: number,
  ): Promise<void> {
    if (this.backupProvider === undefined) {
      throw new MigrationError(
        "backup_required",
        `Migration ${migration.version} requires a verified backup.`,
      );
    }

    let backup: VerifiedMigrationBackup;
    try {
      backup = await this.backupProvider.createVerifiedBackup({
        fromVersion,
        toVersion: migration.version,
        migrationName: migration.name,
        requestedAt: toIsoTimestamp(this.now()),
      });
    } catch (cause) {
      throw new MigrationError(
        "backup_failed",
        `The preventive backup for migration ${migration.version} failed.`,
        cause,
      );
    }

    if (!isVerifiedBackup(backup)) {
      throw new MigrationError(
        "backup_failed",
        `The preventive backup for migration ${migration.version} is not verified.`,
      );
    }
  }

  private async applyMigration(migration: DatabaseMigration): Promise<void> {
    await this.database.execute("BEGIN IMMEDIATE;");
    try {
      await this.database.execute(migration.up);
      await this.database.run(
        `
          INSERT INTO schema_migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `,
        [migration.version, migration.name, toIsoTimestamp(this.now())],
      );
      await this.database.execute("COMMIT;");
    } catch (cause) {
      try {
        await this.database.execute("ROLLBACK;");
      } catch {
        // The original migration error remains the actionable failure.
      }
      throw new MigrationError(
        "migration_failed",
        `Migration ${migration.version} could not be applied.`,
        cause,
      );
    }
  }
}

function validateMigrationCatalog(migrations: readonly DatabaseMigration[]): void {
  const names = new Set<string>();

  for (const [index, migration] of migrations.entries()) {
    const expectedVersion = index + 1;
    if (
      migration.version !== expectedVersion ||
      !migrationNamePattern.test(migration.name) ||
      names.has(migration.name) ||
      typeof migration.requiresBackup !== "boolean" ||
      migration.up.trim().length === 0 ||
      migration.down.trim().length === 0
    ) {
      throw new MigrationError(
        "invalid_migration_catalog",
        "Migrations must be contiguous, uniquely named and fully defined.",
      );
    }
    names.add(migration.name);
  }
}

function validateAppliedMigrations(
  appliedMigrations: readonly AppliedMigrationRow[],
  catalog: readonly DatabaseMigration[],
): void {
  for (const [index, applied] of appliedMigrations.entries()) {
    const expectedVersion = index + 1;
    if (!Number.isInteger(applied.version) || applied.version !== expectedVersion) {
      throw new MigrationError(
        "invalid_migration_history",
        "Applied migration versions must be contiguous.",
      );
    }

    const knownMigration = catalog[index];
    if (knownMigration === undefined) {
      throw new MigrationError(
        "unknown_database_version",
        `Database version ${applied.version} is newer than this application.`,
      );
    }
    if (
      knownMigration.name !== applied.name &&
      !knownMigration.legacyNames?.includes(applied.name)
    ) {
      throw new MigrationError(
        "applied_migration_mismatch",
        `Applied migration ${applied.version} (${applied.name}) does not match the application catalog (${knownMigration.name}).`,
      );
    }
  }
}

function isVerifiedBackup(backup: VerifiedMigrationBackup): boolean {
  return (
    backup.id.trim().length > 0 &&
    backup.id.length <= 128 &&
    sha256Pattern.test(backup.checksumSha256) &&
    Number.isFinite(Date.parse(backup.createdAt))
  );
}

function toIsoTimestamp(value: Date): string {
  if (!Number.isFinite(value.getTime())) {
    throw new MigrationError(
      "migration_failed",
      "The migration clock returned an invalid timestamp.",
    );
  }
  return value.toISOString();
}
