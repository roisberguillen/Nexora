import type { BrowserLedger } from "@nexora/database";

const nexoraStorageKeys = [
  "nexora.app-preferences.v1",
  "nexora.app-lock.v1",
  "nexora.backup-history.v1",
  "nexora.ledger-storage.v1",
  "nexora.local-notifications.v1",
  "nexora.notification-preferences.v1",
] as const;

export interface LocalResetEnvironment {
  readonly caches?: Pick<CacheStorage, "keys" | "delete">;
  readonly indexedDb?: Pick<IDBFactory, "deleteDatabase">;
  readonly localStorage?: Pick<Storage, "removeItem">;
}

/** Removes only Nexora-owned local state. Cloud backups are intentionally out of scope. */
export async function resetLocalApp(
  ledger: BrowserLedger,
  environment: LocalResetEnvironment = {},
): Promise<void> {
  // OPFS SQLite needs its directory and schema container to remain available to reopen reliably.
  // Clear every financial store atomically before closing it; only technical schema metadata remains.
  if (ledger.storageKind === "opfs") {
    await ledger.repository.resetFinancialData();
  }
  await ledger.close();
  const storage = environment.localStorage ?? globalThis.localStorage;
  for (const key of nexoraStorageKeys) storage.removeItem(key);

  if (ledger.storageKind === "indexeddb") {
    await deleteIndexedDb(environment.indexedDb ?? globalThis.indexedDB, "nexora-ledger");
  }

  const cacheStorage = environment.caches ?? globalThis.caches;
  if (cacheStorage !== undefined) {
    await Promise.all(
      (await cacheStorage.keys())
        .filter((name) => name.startsWith("nexora"))
        .map((name) => cacheStorage.delete(name)),
    );
  }
}

function deleteIndexedDb(
  factory: Pick<IDBFactory, "deleteDatabase"> | undefined,
  name: string,
): Promise<void> {
  if (factory === undefined) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB deletion failed."));
    request.onblocked = () => reject(new Error("IndexedDB deletion is blocked by another tab."));
  });
}
