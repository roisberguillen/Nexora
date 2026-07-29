import type { BrowserLedgerStorageKind } from "@nexora/database";

import { PWA_LEDGER_STORAGE_KEY } from "../persistence/openPwaLedger";

export interface StoragePreferenceReader {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

/** Treats the browser hint as advisory and removes malformed values before discovery. */
export function readStoragePreferenceHint(
  storage: StoragePreferenceReader | undefined = getLocalStorage(),
): BrowserLedgerStorageKind | undefined {
  if (storage === undefined) return undefined;
  try {
    const value = storage.getItem(PWA_LEDGER_STORAGE_KEY);
    if (value === null) return undefined;
    if (value === "opfs" || value === "indexeddb") return value;
    storage.removeItem(PWA_LEDGER_STORAGE_KEY);
    return undefined;
  } catch {
    return undefined;
  }
}

function getLocalStorage(): StoragePreferenceReader | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
