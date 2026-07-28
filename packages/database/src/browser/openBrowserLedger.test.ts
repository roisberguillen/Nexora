// @vitest-environment node

import type { LedgerRepository } from "@nexora/domain";
import { describe, expect, it, vi } from "vitest";

import { InMemoryLedgerRepository } from "../in-memory/InMemoryLedgerRepository";
import type { IndexedDbLedger } from "../indexeddb/openIndexedDbLedger";
import type { OpfsLedger } from "../opfs/openOpfsLedger";
import { PersistenceError } from "../sqlite/PersistenceError";
import { type BrowserLedgerOpeners, openBrowserLedger } from "./openBrowserLedger";

function ledger(storageKind: "opfs" | "indexeddb"): OpfsLedger | IndexedDbLedger {
  const repository: LedgerRepository = new InMemoryLedgerRepository();
  const close = vi.fn(async () => undefined);
  if (storageKind === "opfs") {
    return {
      repository,
      close,
      database: { storageKind: "opfs" },
      migration: { fromVersion: 0, toVersion: 1, appliedMigrations: [1] },
    } as unknown as OpfsLedger;
  }
  return {
    repository,
    close,
    database: {},
    schemaVersion: 1,
    storageKind: "indexeddb",
  } as unknown as IndexedDbLedger;
}

function openers(options: {
  readonly supported: boolean;
  readonly opfsResult?: OpfsLedger;
  readonly opfsError?: unknown;
}): BrowserLedgerOpeners {
  return {
    isOpfsSupported: vi.fn(() => options.supported),
    openOpfs: vi.fn(async () => {
      if (options.opfsError !== undefined) {
        throw options.opfsError;
      }
      return options.opfsResult ?? (ledger("opfs") as OpfsLedger);
    }),
    openIndexedDb: vi.fn(async () => ledger("indexeddb") as IndexedDbLedger),
  };
}

describe("openBrowserLedger", () => {
  it("preferisce OPFS quando il contesto lo supporta", async () => {
    const dependencies = openers({ supported: true });

    const result = await openBrowserLedger({}, dependencies);

    expect(result.storageKind).toBe("opfs");
    expect(result.schemaVersion).toBe(1);
    expect(dependencies.openOpfs).toHaveBeenCalledOnce();
    expect(dependencies.openIndexedDb).not.toHaveBeenCalled();
  });

  it("usa IndexedDB quando OPFS non è supportato", async () => {
    const dependencies = openers({ supported: false });

    const result = await openBrowserLedger({}, dependencies);

    expect(result.storageKind).toBe("indexeddb");
    expect(dependencies.openOpfs).not.toHaveBeenCalled();
    expect(dependencies.openIndexedDb).toHaveBeenCalledOnce();
  });

  it("usa IndexedDB quando il worker conferma che OPFS è indisponibile", async () => {
    const dependencies = openers({
      supported: true,
      opfsError: new PersistenceError("opfs_unavailable", "OPFS unavailable."),
    });

    const result = await openBrowserLedger({}, dependencies);

    expect(result.storageKind).toBe("indexeddb");
    expect(dependencies.openIndexedDb).toHaveBeenCalledOnce();
  });

  it("mantiene IndexedDB quando è il backend già selezionato", async () => {
    const dependencies = openers({ supported: true });

    const result = await openBrowserLedger({ preferredStorageKind: "indexeddb" }, dependencies);

    expect(result.storageKind).toBe("indexeddb");
    expect(dependencies.openOpfs).not.toHaveBeenCalled();
    expect(dependencies.openIndexedDb).toHaveBeenCalledOnce();
  });

  it("non cambia archivio quando OPFS era già selezionato ma non è più disponibile", async () => {
    const dependencies = openers({ supported: false });

    await expect(
      openBrowserLedger({ preferredStorageKind: "opfs" }, dependencies),
    ).rejects.toMatchObject({
      code: "opfs_unavailable",
    });
    expect(dependencies.openOpfs).not.toHaveBeenCalled();
    expect(dependencies.openIndexedDb).not.toHaveBeenCalled();
  });

  it("non usa IndexedDB se l'apertura dell'OPFS già selezionato fallisce", async () => {
    const failure = new PersistenceError("opfs_unavailable", "OPFS unavailable.");
    const dependencies = openers({ supported: true, opfsError: failure });

    await expect(openBrowserLedger({ preferredStorageKind: "opfs" }, dependencies)).rejects.toBe(
      failure,
    );
    expect(dependencies.openIndexedDb).not.toHaveBeenCalled();
  });

  it("non maschera un errore del database OPFS con un archivio alternativo", async () => {
    const failure = new PersistenceError("worker_failed", "Existing OPFS database failed.");
    const dependencies = openers({ supported: true, opfsError: failure });

    await expect(openBrowserLedger({}, dependencies)).rejects.toBe(failure);
    expect(dependencies.openIndexedDb).not.toHaveBeenCalled();
  });
});
