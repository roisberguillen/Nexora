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
const verifiedBudgetMigrationBackupProvider: MigrationBackupProvider = {
  async createVerifiedBackup() {
    return {
      id: "budget-migration-checkpoint",
      createdAt: fixedNow.toISOString(),
      checksumSha256: verifiedChecksum,
    };
  },
};

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
      backupProvider: verifiedBudgetMigrationBackupProvider,
      now: () => fixedNow,
    });

    await expect(runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 0,
      toVersion: 20,
      appliedMigrations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
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
      { version: 13, name: "import-row-deletion-audit" },
      { version: 14, name: "import-mapping-profiles" },
      { version: 15, name: "generic-csv-importer" },
      { version: 16, name: "expense-behavior" },
      { version: 17, name: "advanced-recurring-rules" },
      { version: 18, name: "budget-alert-thresholds" },
      { version: 19, name: "recurring-monthly-budgets" },
      { version: 20, name: "mediobanca-csv-importer" },
    ]);

    await expect(runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 20,
      toVersion: 20,
      appliedMigrations: [],
    });
    expect(migrationRows(sqlite)).toHaveLength(20);
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
      backupProvider: verifiedBudgetMigrationBackupProvider,
      now: () => fixedNow,
    });
    await expect(v11Runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 10,
      toVersion: 20,
      appliedMigrations: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    });
    expect(tableCount(sqlite, "monthly_journals")).toBe(1);
    expect(sqlite.prepare("SELECT name FROM accounts WHERE id = ?").get("account-v10")).toEqual({
      name: "Conto v10",
    });
  });

  it("aggiorna le ricorrenze v16 senza reinterpretare il calendario legacy", async () => {
    const legacyRunner = new MigrationRunner({
      database,
      migrations: databaseMigrations.filter((migration) => migration.version <= 16),
      now: () => fixedNow,
    });
    await legacyRunner.migrateToLatest();
    await database.run(
      "INSERT INTO accounts (id, name, type, institution, currency, parent_account_id, opening_balance_minor, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["legacy-account", "Conto legacy", "checking", null, "EUR", null, "0", 0],
    );
    await database.run(
      "INSERT INTO recurring_rules (id, name, kind, account_id, amount_minor, currency, category_id, payee, frequency, interval_months, nominal_day, weekend_policy, next_expected_date, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "legacy-monthly",
        "Canone legacy",
        "expense",
        "legacy-account",
        "-9900",
        "EUR",
        null,
        null,
        "monthly",
        3,
        31,
        "salary_italy",
        "2026-08-31",
        1,
      ],
    );

    const runner = new MigrationRunner({
      database,
      migrations: databaseMigrations,
      backupProvider: verifiedBudgetMigrationBackupProvider,
      now: () => fixedNow,
    });
    await expect(runner.migrateToLatest()).resolves.toEqual({
      fromVersion: 16,
      toVersion: 20,
      appliedMigrations: [17, 18, 19, 20],
    });
    expect(
      sqlite
        .prepare(
          "SELECT frequency_unit, interval_value, nominal_month, next_nominal_date, weekend_policy_v2, retired_at, expense_variability, expense_exceptionality FROM recurring_rules WHERE id = ?",
        )
        .get("legacy-monthly"),
    ).toEqual({
      frequency_unit: "month",
      interval_value: 3,
      nominal_month: null,
      next_nominal_date: null,
      weekend_policy_v2: "salary_italy",
      retired_at: null,
      expense_variability: null,
      expense_exceptionality: null,
    });
  });

  it("migra i flag budget legacy nelle soglie storiche senza perdere il budget", async () => {
    const legacyRunner = new MigrationRunner({
      database,
      migrations: databaseMigrations.filter((migration) => migration.version <= 17),
      now: () => fixedNow,
    });
    await legacyRunner.migrateToLatest();
    await database.run(
      "INSERT INTO budgets (id, period, category_id, amount_minor, currency, alert_at_80, alert_at_100) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["legacy-budget", "2026-08", null, "50000", "EUR", 1, 1],
    );

    const runner = new MigrationRunner({
      database,
      migrations: databaseMigrations,
      backupProvider: verifiedBudgetMigrationBackupProvider,
      now: () => fixedNow,
    });
    await expect(runner.migrateToLatest()).resolves.toMatchObject({
      fromVersion: 17,
      toVersion: 20,
      appliedMigrations: [18, 19, 20],
    });
    expect(
      sqlite
        .prepare(
          "SELECT id, amount_minor, first_alert_percentage, second_alert_percentage FROM budgets WHERE id = ?",
        )
        .get("legacy-budget"),
    ).toEqual({
      id: "legacy-budget",
      amount_minor: "50000",
      first_alert_percentage: 80,
      second_alert_percentage: 100,
    });
  });

  it("ripara senza perdita il nome storico della migrazione v13", async () => {
    const legacyRunner = new MigrationRunner({
      database,
      migrations: databaseMigrations.filter((migration) => migration.version <= 12),
      now: () => fixedNow,
    });
    await legacyRunner.migrateToLatest();
    await database.run(
      "INSERT INTO import_batches (id, importer_type, source_filename, source_sha256, status, started_at, rows_total) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "legacy-batch",
        "money_manager_xlsx",
        "legacy.xlsx",
        "a".repeat(64),
        "committed",
        fixedNow.toISOString(),
        0,
      ],
    );
    await database.run(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      [13, "import-fingerprint-tombstones", fixedNow.toISOString()],
    );

    const runner = new MigrationRunner({
      database,
      migrations: databaseMigrations,
      backupProvider: verifiedBudgetMigrationBackupProvider,
      now: () => fixedNow,
    });
    await expect(runner.migrateToLatest()).resolves.toMatchObject({
      fromVersion: 13,
      toVersion: 20,
      appliedMigrations: [14, 15, 16, 17, 18, 19, 20],
    });
    expect(
      sqlite
        .prepare("PRAGMA table_info(import_rows)")
        .all()
        .some((column) => (column as { name: string }).name === "deleted_transaction_id"),
    ).toBe(true);
    expect(migrationRows(sqlite).find(({ version }) => version === 13)).toEqual({
      version: 13,
      name: "import-row-deletion-audit",
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
