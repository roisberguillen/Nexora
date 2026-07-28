import { openIndexedDbLedger } from "../../../packages/database/src";
import { Account, Money } from "../../../packages/domain/src";

export interface IndexedDbSmokeResult {
  readonly amountMinor: string;
  readonly firstSchemaVersion: number;
  readonly reopenedSchemaVersion: number;
  readonly storageKind: string;
}

export async function runIndexedDbSmokeTest(databaseName: string): Promise<IndexedDbSmokeResult> {
  const account = Account.create({
    id: "indexeddb-smoke-account",
    name: "Conto sintetico IndexedDB",
    type: "checking",
    currency: "EUR",
    openingBalance: Money.fromMinor(900719925474099312345678901234567890n, "EUR"),
  });

  try {
    const firstLedger = await openIndexedDbLedger({ databaseName });
    await firstLedger.repository.saveAccount(account);
    const firstSchemaVersion = firstLedger.schemaVersion;
    const storageKind = firstLedger.storageKind;
    await firstLedger.close();

    const reopenedLedger = await openIndexedDbLedger({ databaseName });
    const restored = await reopenedLedger.repository.findAccountById(account.id);
    const reopenedSchemaVersion = reopenedLedger.schemaVersion;
    await reopenedLedger.close();

    if (restored === undefined) {
      throw new Error("The persisted IndexedDB account was not restored.");
    }

    return {
      amountMinor: restored.openingBalance.amountMinor.toString(),
      firstSchemaVersion,
      reopenedSchemaVersion,
      storageKind,
    };
  } finally {
    await deleteDatabase(databaseName);
  }
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("The IndexedDB smoke database could not be deleted."));
    };
    request.onblocked = () => {
      reject(new Error("The IndexedDB smoke database deletion is blocked."));
    };
  });
}
