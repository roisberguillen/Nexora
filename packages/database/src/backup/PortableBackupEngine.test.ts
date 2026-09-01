// @vitest-environment node

import { DatabaseSync } from "node:sqlite";

import { Account, Money } from "@nexora/domain";
import { IDBFactory } from "fake-indexeddb";
import { beforeAll, describe, expect, it } from "vitest";

import {
  PORTABLE_LEDGER_SCHEMA_VERSION,
  openIndexedDbLedger,
} from "../indexeddb/openIndexedDbLedger";
import { initializeSqliteLedger } from "../sqlite/initializeSqliteLedger";
import type { SqliteDatabase, SqliteValue } from "../sqlite/SqliteDatabase";
import {
  capturePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  type ValidatedPortableLedgerSnapshot,
} from "./PortableLedgerSnapshot";
import { createEncryptedPayloadBackup } from "./EncryptedSqliteBackup";
import { PortableBackupEngine, type PortableBackupRepository } from "./PortableBackupEngine";

const passphrase = "passphrase-sintetica-backup";
const createdAt = "2026-08-02T12:00:00.000Z";
const sourceAccount = Account.create({
  id: "source-account",
  name: "Conto sorgente",
  type: "checking",
  currency: "EUR",
  openingBalance: Money.fromMinor(12_345n, "EUR"),
});
const previousAccount = Account.create({
  id: "previous-account",
  name: "Conto precedente",
  type: "savings",
  currency: "EUR",
});

let archive: Uint8Array;
let futureArchive: Uint8Array;

function nodeSqliteDatabase(database: DatabaseSync): SqliteDatabase {
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

beforeAll(async () => {
  const factory = new IDBFactory();
  const source = await openIndexedDbLedger({ databaseName: "backup-engine-source", factory });
  try {
    await source.repository.saveAccount(sourceAccount);
    const engine = new PortableBackupEngine({
      repository: source.repository,
      schemaVersion: source.portableSchemaVersion,
      appVersion: "0.5.0",
      now: () => new Date(createdAt),
      idFactory: () => "test-backup",
    });
    const created = await engine.createBackup(passphrase);
    archive = created.archive;
    expect(created).toMatchObject({
      id: "nexora-portable-test-backup.nexora-backup",
      createdAt,
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      manifest: {
        schemaVersion: PORTABLE_LEDGER_SCHEMA_VERSION,
        appVersion: "0.5.0",
      },
      summary: expect.objectContaining({ accounts: 1, transactions: 0 }),
    });
    const payload = encodePortableLedgerSnapshot(
      await capturePortableLedgerSnapshot(source.repository),
    );
    futureArchive = await createEncryptedPayloadBackup({
      payloadBytes: payload,
      path: "ledger.json",
      schemaVersion: PORTABLE_LEDGER_SCHEMA_VERSION + 1,
      createdAt,
      passphrase,
    });
  } finally {
    await source.close();
  }
});

describe("PortableBackupEngine", () => {
  it("crea da IndexedDB e ripristina lo stesso archivio verificato su SQLite", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      const destination = await initializeSqliteLedger({
        database: nodeSqliteDatabase(sqlite),
      });
      await destination.repository.saveAccount(previousAccount);
      const engine = new PortableBackupEngine({
        repository: destination.repository,
        schemaVersion: destination.migration.toVersion,
      });

      await expect(engine.verifyBackup(archive, passphrase)).resolves.toMatchObject({
        checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        manifest: { schemaVersion: PORTABLE_LEDGER_SCHEMA_VERSION },
      });
      await engine.restoreBackup(archive, passphrase);

      await expect(destination.repository.listAccounts()).resolves.toEqual([sourceAccount]);
    } finally {
      sqlite.close();
    }
  });

  it("ripristina lo stesso archivio verificato anche su IndexedDB", async () => {
    const destination = await openIndexedDbLedger({
      databaseName: "backup-engine-indexeddb-destination",
      factory: new IDBFactory(),
    });
    try {
      await destination.repository.saveAccount(previousAccount);
      const engine = new PortableBackupEngine({
        repository: destination.repository,
        schemaVersion: destination.portableSchemaVersion,
      });

      await engine.restoreBackup(archive, passphrase);

      await expect(destination.repository.listAccounts()).resolves.toEqual([sourceAccount]);
    } finally {
      await destination.close();
    }
  });

  it("rifiuta passphrase errate, tampering e schemi futuri prima di scrivere", async () => {
    const destination = await openIndexedDbLedger({
      databaseName: "backup-engine-negative",
      factory: new IDBFactory(),
    });
    try {
      await destination.repository.saveAccount(previousAccount);
      const engine = new PortableBackupEngine({
        repository: destination.repository,
        schemaVersion: destination.portableSchemaVersion,
      });
      const tampered = archive.slice();
      tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1;

      await expect(
        engine.verifyBackup(archive, "passphrase-sintetica-errata"),
      ).rejects.toMatchObject({ code: "invalid_archive" });
      await expect(engine.verifyBackup(tampered, passphrase)).rejects.toMatchObject({
        code: "invalid_archive",
      });
      await expect(engine.restoreBackup(futureArchive, passphrase)).rejects.toMatchObject({
        code: "unsupported_backup",
      });
      await expect(destination.repository.listAccounts()).resolves.toEqual([previousAccount]);
    } finally {
      await destination.close();
    }
  });

  it("ripristina il checkpoint precedente quando la sostituzione fallisce dopo la scrittura", async () => {
    const destination = await openIndexedDbLedger({
      databaseName: "backup-engine-rollback",
      factory: new IDBFactory(),
    });
    try {
      await destination.repository.saveAccount(previousAccount);
      let replacementCalls = 0;
      const repository = new Proxy(destination.repository, {
        get(target, property, receiver) {
          if (property === "replacePortableSnapshot") {
            return async (snapshot: ValidatedPortableLedgerSnapshot) => {
              replacementCalls += 1;
              await target.replacePortableSnapshot(snapshot);
              if (replacementCalls === 1) throw new Error("Synthetic post-write failure.");
            };
          }
          const value: unknown = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as PortableBackupRepository;
      const engine = new PortableBackupEngine({
        repository,
        schemaVersion: destination.portableSchemaVersion,
      });

      await expect(engine.restoreBackup(archive, passphrase)).rejects.toMatchObject({
        code: "restore_failed",
      });
      expect(replacementCalls).toBe(2);
      await expect(destination.repository.listAccounts()).resolves.toEqual([previousAccount]);
    } finally {
      await destination.close();
    }
  });
});
