// @vitest-environment node

import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { databaseMigrations, initialLedgerSchemaMigration } from "./0001-initial-ledger-schema";
import type { DatabaseMigration } from "./DatabaseMigration";
import type { MigrationBackupProvider, MigrationBackupRequest } from "./MigrationBackup";
import { MigrationError } from "./MigrationError";
import { MigrationRunner } from "./MigrationRunner";
import type { SqliteDatabase, SqliteValue } from "../sqlite/SqliteDatabase";

interface CountRow {
  readonly count: number;
}

interface MigrationRow {
  readonly name: string;
  readonly version: number;
}

const fixedNow = new Date("2026-07-27T10:00:00.000Z");
const verifiedChecksum = "a".repeat(64);

function nodeMigrationDatabase(database: DatabaseSync): SqliteDatabase {
  return {
    async execute(sql: string): Promise<void> {
      database.exec(sql);
    },
    async query<Row extends object>(
      sql: string,
      parameters: readonly SqliteValue[] = [],
    ): Promise<readonly Row[]> {
      return database.prepare(sql).all(...parameters) as unknown as readonly Row[];
    },
    async run(sql: string, parameters: readonly SqliteValue[] = []): Promise<void> {
      database.prepare(sql).run(...parameters);
    },
  };
}

function markerMigration(options?: {
  readonly name?: string;
  readonly requiresBackup?: boolean;
  readonly up?: string;
}): DatabaseMigration {
  return {
    version: 2,
    name: options?.name ?? "add-migration-marker",
    requiresBackup: options?.requiresBackup ?? true,
    up:
      options?.up ??
      `
        CREATE TABLE migration_marker (
          id INTEGER PRIMARY KEY,
          label TEXT NOT NULL
        ) STRICT;
      `,
    down: "DROP TABLE IF EXISTS migration_marker;",
  };
}

function migrationRows(database: DatabaseSync): readonly MigrationRow[] {
  return database
    .prepare(
      `
        SELECT version, name
        FROM schema_migrations
        ORDER BY version ASC
      `,
    )
    .all() as unknown as readonly MigrationRow[];
}

function tableCount(database: DatabaseSync, tableName: string): number {
  const row = database
    .prepare(
      `
        SELECT count(*) AS count
        FROM sqlite_schema
        WHERE type = 'table' AND name = ?
      `,
    )
    .get(tableName) as unknown as CountRow;
  return row.count;
}

describe("MigrationRunner", () => {
  let sqlite: DatabaseSync;
  let database: SqliteDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    database = nodeMigrationDatabase(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("applica la migrazione iniziale una sola volta", async () => {
    const runner = new MigrationRunner({
      database,
      migrations: databaseMigrations,
      now: () => fixedNow,
    });

    await expect(runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 0,
      toVersion: 12,
      appliedMigrations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    });
    expect(migrationRows(sqlite)).toEqual([
      {
        version: 1,
        name: initialLedgerSchemaMigration.name,
      },
      {
        version: 2,
        name: "transaction-splits",
      },
      {
        version: 3,
        name: "tags",
      },
      {
        version: 4,
        name: "import-batches",
      },
      {
        version: 5,
        name: "recurring-rules",
      },
      { version: 6, name: "allocation-plans" },
      { version: 7, name: "budgets" },
      { version: 8, name: "loans" },
      { version: 9, name: "investment-positions" },
      { version: 10, name: "bank-importer-types" },
      { version: 11, name: "monthly-journals" },
      { version: 12, name: "transaction-trash" },
    ]);

    await expect(runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 12,
      toVersion: 12,
      appliedMigrations: [],
    });
    expect(migrationRows(sqlite)).toHaveLength(12);
  });

  it("aggiorna un database v10 senza perdere dati già presenti", async () => {
    const v10Runner = new MigrationRunner({
      database,
      migrations: databaseMigrations.filter((migration) => migration.version <= 10),
      now: () => fixedNow,
    });
    await v10Runner.migrateToLatest();
    await database.run(
      "INSERT INTO accounts (id, name, type, institution, currency, parent_account_id, opening_balance_minor, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["account-v10", "Conto v10", "checking", null, "EUR", null, "0", 0],
    );

    const v11Runner = new MigrationRunner({
      database,
      migrations: databaseMigrations,
      now: () => fixedNow,
    });
    await expect(v11Runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 10,
      toVersion: 12,
      appliedMigrations: [11, 12],
    });
    expect(tableCount(sqlite, "monthly_journals")).toBe(1);
    expect(sqlite.prepare("SELECT name FROM accounts WHERE id = ?").get("account-v10")).toEqual({
      name: "Conto v10",
    });
  });

  it("annulla l'intera migrazione quando un'istruzione fallisce", async () => {
    const failingMigration = markerMigration({
      requiresBackup: false,
      up: `
        CREATE TABLE migration_marker (id INTEGER PRIMARY KEY) STRICT;
        INSERT INTO missing_table (id) VALUES (1);
      `,
    });
    const runner = new MigrationRunner({
      database,
      migrations: [initialLedgerSchemaMigration, failingMigration],
      now: () => fixedNow,
    });

    await expect(runner.migrateToLatest()).rejects.toMatchObject({
      code: "migration_failed",
    });

    expect(migrationRows(sqlite)).toEqual([
      {
        version: 1,
        name: initialLedgerSchemaMigration.name,
      },
    ]);
    expect(tableCount(sqlite, "migration_marker")).toBe(0);
  });

  it("blocca una migrazione distruttiva quando manca il provider di backup", async () => {
    const runner = new MigrationRunner({
      database,
      migrations: [initialLedgerSchemaMigration, markerMigration()],
      now: () => fixedNow,
    });

    await expect(runner.migrateToLatest()).rejects.toMatchObject({
      code: "backup_required",
    });
    expect(migrationRows(sqlite)).toHaveLength(1);
    expect(tableCount(sqlite, "migration_marker")).toBe(0);
  });

  it("verifica il backup prima di applicare una migrazione distruttiva", async () => {
    let receivedRequest: MigrationBackupRequest | undefined;
    let markerExistedDuringBackup: boolean | undefined;
    let backupCalls = 0;
    const backupProvider: MigrationBackupProvider = {
      async createVerifiedBackup(request) {
        backupCalls += 1;
        receivedRequest = request;
        markerExistedDuringBackup = tableCount(sqlite, "migration_marker") > 0;
        return {
          id: "backup-before-v2",
          createdAt: fixedNow.toISOString(),
          checksumSha256: verifiedChecksum,
        };
      },
    };
    const secondMigration = markerMigration();
    const runner = new MigrationRunner({
      database,
      migrations: [initialLedgerSchemaMigration, secondMigration],
      backupProvider,
      now: () => fixedNow,
    });

    await expect(runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 0,
      toVersion: 2,
      appliedMigrations: [1, 2],
    });

    expect(receivedRequest).toEqual({
      fromVersion: 1,
      toVersion: 2,
      migrationName: secondMigration.name,
      requestedAt: fixedNow.toISOString(),
    });
    expect(markerExistedDuringBackup).toBe(false);
    expect(tableCount(sqlite, "migration_marker")).toBe(1);
    expect(migrationRows(sqlite)).toHaveLength(2);

    await expect(runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 2,
      toVersion: 2,
      appliedMigrations: [],
    });
    expect(backupCalls).toBe(1);
  });

  it("non avvia la migrazione se il backup fallisce", async () => {
    const backupProvider: MigrationBackupProvider = {
      async createVerifiedBackup() {
        throw new Error("Synthetic backup failure");
      },
    };
    const runner = new MigrationRunner({
      database,
      migrations: [initialLedgerSchemaMigration, markerMigration()],
      backupProvider,
      now: () => fixedNow,
    });

    await expect(runner.migrateToLatest()).rejects.toMatchObject({
      code: "backup_failed",
    });
    expect(migrationRows(sqlite)).toHaveLength(1);
    expect(tableCount(sqlite, "migration_marker")).toBe(0);
  });

  it("rifiuta una ricevuta di backup priva di checksum verificabile", async () => {
    const backupProvider: MigrationBackupProvider = {
      async createVerifiedBackup() {
        return {
          id: "backup-invalid",
          createdAt: fixedNow.toISOString(),
          checksumSha256: "not-a-sha256",
        };
      },
    };
    const runner = new MigrationRunner({
      database,
      migrations: [initialLedgerSchemaMigration, markerMigration()],
      backupProvider,
      now: () => fixedNow,
    });

    await expect(runner.migrateToLatest()).rejects.toMatchObject({
      code: "backup_failed",
    });
    expect(tableCount(sqlite, "migration_marker")).toBe(0);
  });

  it("rileva uno storico applicato che non corrisponde al catalogo", async () => {
    const runner = new MigrationRunner({
      database,
      migrations: databaseMigrations,
      now: () => fixedNow,
    });
    await runner.migrateToLatest();
    sqlite.prepare("UPDATE schema_migrations SET name = 'unexpected-name' WHERE version = 1").run();

    await expect(runner.migrateToLatest()).rejects.toMatchObject({
      code: "applied_migration_mismatch",
    });
  });

  it("rifiuta un catalogo non contiguo prima di accedere al database", () => {
    const invalidMigration: DatabaseMigration = {
      ...markerMigration({ requiresBackup: false }),
      version: 3,
    };

    expect(
      () =>
        new MigrationRunner({
          database,
          migrations: [initialLedgerSchemaMigration, invalidMigration],
        }),
    ).toThrowError(MigrationError);
  });
});
