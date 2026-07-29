import { InMemoryLedgerRepository, PersistenceError, type BrowserLedger } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import {
  openPwaLedger,
  PWA_LEDGER_STORAGE_KEY,
  persistPwaLedgerSelection,
  type LedgerPreferenceStorage,
} from "./openPwaLedger";

function ledger(storageKind: BrowserLedger["storageKind"]): BrowserLedger {
  return {
    repository: new InMemoryLedgerRepository(),
    schemaVersion: 1,
    storageKind,
    close: vi.fn(async () => undefined),
  };
}

function memoryPreference(
  initialValue: string | null = null,
): LedgerPreferenceStorage & { readonly setItem: ReturnType<typeof vi.fn> } {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((key: string, nextValue: string) => {
      expect(key).toBe(PWA_LEDGER_STORAGE_KEY);
      value = nextValue;
    }),
  };
}

describe("openPwaLedger", () => {
  it("registra il backend soltanto dopo la prima apertura riuscita", async () => {
    const preferenceStorage = memoryPreference();
    const openedLedger = ledger("opfs");
    const openLedger = vi.fn(async () => openedLedger);

    await expect(openPwaLedger({ openLedger, preferenceStorage })).resolves.toBe(openedLedger);

    expect(openLedger).toHaveBeenCalledWith({});
    expect(preferenceStorage.setItem).toHaveBeenCalledWith(PWA_LEDGER_STORAGE_KEY, "opfs");
  });

  it("forza il backend registrato senza riscrivere la preferenza", async () => {
    const preferenceStorage = memoryPreference("indexeddb");
    const openedLedger = ledger("indexeddb");
    const openLedger = vi.fn(async () => openedLedger);

    await openPwaLedger({ openLedger, preferenceStorage });

    expect(openLedger).toHaveBeenCalledWith({
      preferredStorageKind: "indexeddb",
    });
    expect(preferenceStorage.setItem).not.toHaveBeenCalled();
  });

  it("può ritardare la persistenza fino alla verifica completa dell'avvio", async () => {
    const preferenceStorage = memoryPreference();
    const openedLedger = ledger("indexeddb");

    await openPwaLedger({
      selectedStorageKind: "indexeddb",
      persistSelection: false,
      openLedger: vi.fn(async () => openedLedger),
      preferenceStorage,
    });

    expect(preferenceStorage.setItem).not.toHaveBeenCalled();
    persistPwaLedgerSelection("indexeddb", preferenceStorage);
    expect(preferenceStorage.setItem).toHaveBeenCalledWith(PWA_LEDGER_STORAGE_KEY, "indexeddb");
  });

  it("rifiuta una preferenza corrotta prima di aprire un archivio", async () => {
    const preferenceStorage = memoryPreference("memory");
    const openLedger = vi.fn(async () => ledger("opfs"));

    await expect(openPwaLedger({ openLedger, preferenceStorage })).rejects.toMatchObject({
      code: "corrupt_record",
    });
    expect(openLedger).not.toHaveBeenCalled();
  });

  it("chiude il ledger se la preferenza iniziale non può essere salvata", async () => {
    const openedLedger = ledger("opfs");
    const preferenceStorage: LedgerPreferenceStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
    };

    await expect(
      openPwaLedger({
        openLedger: vi.fn(async () => openedLedger),
        preferenceStorage,
      }),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(openedLedger.close).toHaveBeenCalledOnce();
  });

  it("rifiuta un opener che restituisce un backend diverso da quello registrato", async () => {
    const openedLedger = ledger("opfs");

    await expect(
      openPwaLedger({
        openLedger: vi.fn(async () => openedLedger),
        preferenceStorage: memoryPreference("indexeddb"),
      }),
    ).rejects.toMatchObject({
      code: "database_operation_failed",
    });
    expect(openedLedger.close).toHaveBeenCalledOnce();
  });
});
