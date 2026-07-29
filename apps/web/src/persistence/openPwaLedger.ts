import {
  openBrowserLedger,
  PersistenceError,
  type BrowserLedger,
  type BrowserLedgerStorageKind,
  type OpenBrowserLedgerOptions,
} from "@nexora/database";

export const PWA_LEDGER_STORAGE_KEY = "nexora.ledger-storage.v1";

export interface LedgerPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OpenPwaLedgerOptions {
  readonly browser?: Omit<OpenBrowserLedgerOptions, "preferredStorageKind">;
  /** A verified startup selection takes precedence over the non-authoritative stored hint. */
  readonly selectedStorageKind?: BrowserLedgerStorageKind;
  /** Bootstrap persists only after validation has reached READY. */
  readonly persistSelection?: boolean;
  readonly preferenceStorage?: LedgerPreferenceStorage;
  readonly openLedger?: (options: OpenBrowserLedgerOptions) => Promise<BrowserLedger>;
}

export async function openPwaLedger(options: OpenPwaLedgerOptions = {}): Promise<BrowserLedger> {
  const preferenceStorage = options.preferenceStorage ?? getDefaultPreferenceStorage();
  const selectedStorageKind =
    options.selectedStorageKind ?? readSelectedStorageKind(preferenceStorage);
  const openOptions =
    selectedStorageKind === undefined
      ? (options.browser ?? {})
      : {
          ...options.browser,
          preferredStorageKind: selectedStorageKind,
        };
  const ledger = await (options.openLedger ?? openBrowserLedger)(openOptions);

  if (selectedStorageKind !== undefined && selectedStorageKind !== ledger.storageKind) {
    await closeAfterSelectionFailure(ledger);
    throw new PersistenceError(
      "database_operation_failed",
      "The opened ledger does not match the persisted storage selection.",
    );
  }

  if (
    options.persistSelection !== false &&
    (options.selectedStorageKind !== undefined || selectedStorageKind === undefined)
  ) {
    try {
      preferenceStorage.setItem(PWA_LEDGER_STORAGE_KEY, ledger.storageKind);
    } catch (cause) {
      await closeAfterSelectionFailure(ledger);
      throw new PersistenceError(
        "database_operation_failed",
        "The selected ledger backend could not be persisted safely.",
        cause,
      );
    }
  }

  return ledger;
}

/** Persists a backend only after the caller has validated the opened ledger. */
export function persistPwaLedgerSelection(
  storageKind: BrowserLedgerStorageKind,
  preferenceStorage: LedgerPreferenceStorage = getDefaultPreferenceStorage(),
): void {
  try {
    preferenceStorage.setItem(PWA_LEDGER_STORAGE_KEY, storageKind);
  } catch (cause) {
    throw new PersistenceError(
      "database_operation_failed",
      "The selected ledger backend could not be persisted safely.",
      cause,
    );
  }
}

function getDefaultPreferenceStorage(): LedgerPreferenceStorage {
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      return globalThis.localStorage;
    }
  } catch (cause) {
    throw new PersistenceError(
      "database_operation_failed",
      "Browser storage preferences are unavailable.",
      cause,
    );
  }

  throw new PersistenceError(
    "database_operation_failed",
    "Browser storage preferences are unavailable.",
  );
}

function readSelectedStorageKind(
  preferenceStorage: LedgerPreferenceStorage,
): BrowserLedgerStorageKind | undefined {
  let storedValue: string | null;
  try {
    storedValue = preferenceStorage.getItem(PWA_LEDGER_STORAGE_KEY);
  } catch (cause) {
    throw new PersistenceError(
      "database_operation_failed",
      "The selected ledger backend could not be read safely.",
      cause,
    );
  }

  if (storedValue === null) {
    return undefined;
  }
  if (storedValue === "opfs" || storedValue === "indexeddb") {
    return storedValue;
  }
  throw new PersistenceError(
    "corrupt_record",
    "The persisted ledger backend selection is invalid.",
  );
}

async function closeAfterSelectionFailure(ledger: BrowserLedger): Promise<void> {
  try {
    await ledger.close();
  } catch {
    // The selection failure remains the actionable error.
  }
}
