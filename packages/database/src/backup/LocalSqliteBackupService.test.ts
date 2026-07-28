// @vitest-environment node

import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Account, Money } from "@nexora/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initializeSqliteLedger } from "../sqlite/initializeSqliteLedger";
import type { PhysicalSqliteDatabase, SqliteValue } from "../sqlite/SqliteDatabase";
import { seedDemoLedger } from "../seed/demoLedgerSeed";
import { createEncryptedSqliteBackup, sha256Hex } from "./EncryptedSqliteBackup";
import { LocalSqliteBackupService } from "./LocalSqliteBackupService";
import type { PhysicalBackupStore } from "./PhysicalBackupStore";

class MemoryBackupStore implements PhysicalBackupStore {
  public readonly archives = new Map<string, Uint8Array>();

  public async write(id: string, archive: Uint8Array): Promise<void> {
    this.archives.set(id, archive.slice());
  }

  public async read(id: string): Promise<Uint8Array> {
    const archive = this.archives.get(id);
    if (archive === undefined) {
      throw new Error("Synthetic backup does not exist.");
    }
    return archive.slice();
  }
}

class NodePhysicalDatabase implements PhysicalSqliteDatabase {
  public readonly storageKind = "opfs" as const;
  private sqlite: DatabaseSync;

  public constructor(private readonly path: string) {
    this.sqlite = new DatabaseSync(path);
  }

  public async execute(sql: string): Promise<void> {
    this.sqlite.exec(sql);
  }

  public async query<Row extends object>(
    sql: string,
    parameters: readonly SqliteValue[] = [],
  ): Promise<readonly Row[]> {
    return this.sqlite.prepare(sql).all(...parameters) as unknown as readonly Row[];
  }

  public async run(sql: string, parameters: readonly SqliteValue[] = []): Promise<void> {
    this.sqlite.prepare(sql).run(...parameters);
  }

  public async exportDatabase(): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(this.path));
  }

  public async restoreDatabase(bytes: Uint8Array, expectedSchemaVersion: number): Promise<void> {
    const rollbackBytes = await this.exportDatabase();
    this.sqlite.close();
    try {
      writeFileSync(this.path, bytes);
      this.sqlite = new DatabaseSync(this.path);
      const row = this.sqlite
        .prepare("SELECT MAX(version) AS version FROM schema_migrations")
        .get() as { readonly version: number };
      if (row.version !== expectedSchemaVersion) {
        throw new Error("Synthetic restore schema mismatch.");
      }
    } catch (cause) {
      try {
        this.sqlite.close();
      } catch {
        // The replacement connection may not have opened.
      }
      writeFileSync(this.path, rollbackBytes);
      this.sqlite = new DatabaseSync(this.path);
      throw cause;
    }
  }

  public async close(): Promise<void> {
    this.sqlite.close();
  }
}

describe("LocalSqliteBackupService", () => {
  let databasePath: string;
  let database: NodePhysicalDatabase;
  let store: MemoryBackupStore;
  const now = () => new Date("2026-07-27T10:00:00.000Z");

  beforeEach(() => {
    databasePath = join(tmpdir(), `nexora-backup-${randomUUID()}.sqlite3`);
    database = new NodePhysicalDatabase(databasePath);
    store = new MemoryBackupStore();
  });

  afterEach(async () => {
    try {
      await database.close();
    } catch {
      // A test may already have closed the synthetic connection.
    }
    rmSync(databasePath, { force: true });
  });

  it("scrive, rilegge e verifica fisicamente un backup cifrato", async () => {
    const ledger = await initializeSqliteLedger({ database });
    await seedDemoLedger(ledger.repository);
    const service = backupService(database, store, now);

    const backup = await service.createBackup();

    expect(backup).toMatchObject({
      id: expect.stringMatching(/^nexora-v5-.*\.nexora-backup$/),
      createdAt: now().toISOString(),
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      manifest: {
        formatVersion: 1,
        schemaVersion: 5,
        appVersion: "0.4.0",
      },
    });
    const persisted = await store.read(backup.id);
    expect(await sha256Hex(persisted)).toBe(backup.checksumSha256);
  });

  it("ripristina il database e rimuove le modifiche successive al backup", async () => {
    const ledger = await initializeSqliteLedger({ database });
    await seedDemoLedger(ledger.repository);
    const service = backupService(database, store, now);
    const backup = await service.createBackup();
    const laterAccount = Account.create({
      id: "later-account",
      name: "Conto successivo",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(42_000n, "EUR"),
    });
    await ledger.repository.saveAccount(laterAccount);
    await expect(ledger.repository.findAccountById(laterAccount.id)).resolves.toEqual(laterAccount);

    await expect(service.restoreBackup(backup.id, backup.checksumSha256)).resolves.toMatchObject({
      id: backup.id,
      schemaVersion: 5,
    });

    await expect(ledger.repository.findAccountById(laterAccount.id)).resolves.toBeUndefined();
    await expect(ledger.repository.listTransactions()).resolves.toHaveLength(8);
  });

  it("produce una ricevuta verificata compatibile con il runner migrazioni", async () => {
    await initializeSqliteLedger({ database });
    const service = backupService(database, store, now);

    const receipt = await service.createVerifiedBackup({
      fromVersion: 5,
      toVersion: 5,
      migrationName: "synthetic-migration",
      requestedAt: now().toISOString(),
    });

    expect(receipt).toEqual({
      id: expect.stringMatching(/\.nexora-backup$/),
      createdAt: now().toISOString(),
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(store.archives.has(receipt.id)).toBe(true);
  });

  it("non avvia il restore quando il checksum della ricevuta non coincide", async () => {
    const ledger = await initializeSqliteLedger({ database });
    const service = backupService(database, store, now);
    const backup = await service.createBackup();
    const account = Account.create({
      id: "preserved-account",
      name: "Conto preservato",
      type: "cash",
      currency: "EUR",
    });
    await ledger.repository.saveAccount(account);

    await expect(service.restoreBackup(backup.id, "0".repeat(64))).rejects.toMatchObject({
      code: "invalid_archive",
    });
    await expect(ledger.repository.findAccountById(account.id)).resolves.toEqual(account);
  });

  it("rifiuta un backup con schema più recente prima di sostituire il database", async () => {
    const ledger = await initializeSqliteLedger({ database });
    const preserved = Account.create({
      id: "preserved-newer-schema",
      name: "Conto preservato",
      type: "cash",
      currency: "EUR",
    });
    await ledger.repository.saveAccount(preserved);
    const archive = await createEncryptedSqliteBackup({
      databaseBytes: await database.exportDatabase(),
      schemaVersion: 6,
      createdAt: now().toISOString(),
      passphrase: "passphrase-sintetica-backup",
    });
    const id = "newer-schema.nexora-backup";
    await store.write(id, archive);
    const service = backupService(database, store, now);

    await expect(service.restoreBackup(id)).rejects.toMatchObject({
      code: "unsupported_backup",
    });
    await expect(ledger.repository.findAccountById(preserved.id)).resolves.toEqual(preserved);
  });
});

function backupService(
  database: PhysicalSqliteDatabase,
  store: PhysicalBackupStore,
  now: () => Date,
): LocalSqliteBackupService {
  return new LocalSqliteBackupService({
    database,
    store,
    passphrase: "passphrase-sintetica-backup",
    appVersion: "0.4.0",
    now,
    idFactory: () => "synthetic-id",
  });
}
