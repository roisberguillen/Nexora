import {
  InMemoryLedgerRepository,
  type InitializedSqliteLedger,
  type SqliteLedgerRepository,
} from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import { openTauriLedger } from "./openTauriLedger";
import type { TauriSqlClient } from "./TauriSqliteDatabase";

function nativeClient(): TauriSqlClient {
  return {
    execute: vi.fn().mockResolvedValue({}),
    select: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(true),
  };
}

describe("openTauriLedger", () => {
  it("opens the native database, initializes the shared schema and exposes a ledger", async () => {
    const repository = new InMemoryLedgerRepository() as unknown as SqliteLedgerRepository;
    const loadDatabase = vi.fn().mockResolvedValue(nativeClient());
    const initializeLedger = vi.fn().mockResolvedValue({
      repository,
      migration: { fromVersion: 0, toVersion: 13, appliedMigrations: [1, 2, 3] },
    } satisfies InitializedSqliteLedger);

    const ledger = await openTauriLedger({ loadDatabase, initializeLedger });

    expect(loadDatabase).toHaveBeenCalledWith("sqlite:nexora.db");
    expect(initializeLedger).toHaveBeenCalledWith({ database: ledger.database });
    expect(ledger.repository).toBe(repository);
    expect(ledger.schemaVersion).toBe(13);
    expect(ledger.storageKind).toBe("native-sqlite");
  });

  it("rejects database paths outside the app-owned native file", async () => {
    await expect(openTauriLedger({ databaseUrl: "sqlite:../other.db" })).rejects.toMatchObject({
      code: "database_operation_failed",
    });
  });

  it("closes a connection when shared initialization fails", async () => {
    const client = nativeClient();
    await expect(
      openTauriLedger({
        loadDatabase: () => Promise.resolve(client),
        initializeLedger: () => Promise.reject(new Error("migration failed")),
      }),
    ).rejects.toThrow("migration failed");

    expect(client.close).toHaveBeenCalledTimes(1);
  });
});
