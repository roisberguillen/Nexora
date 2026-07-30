import { openIndexedDbLedger, openOpfsLedger } from "../../../packages/database/src";

export async function verifyAtomicRollback(
  backend: "indexeddb" | "opfs",
  location: string,
): Promise<{ readonly persistedAccount: boolean }> {
  if (backend === "indexeddb") await interruptIndexedDbWrite(location);
  else await interruptOpfsWrite(location);

  const reopened =
    backend === "indexeddb"
      ? await openIndexedDbLedger({ databaseName: location })
      : await openOpfsLedger({ filename: location });
  try {
    return {
      persistedAccount:
        (await reopened.repository.findAccountById("rollback-account")) !== undefined,
    };
  } finally {
    await reopened.close();
    if (backend === "indexeddb") await deleteIndexedDb(location);
    else await removeOpfsDirectory(location);
  }
}

async function interruptIndexedDbWrite(databaseName: string): Promise<void> {
  const ledger = await openIndexedDbLedger({ databaseName });
  try {
    await ledger.repository
      .runAtomically(async (transaction) => {
        transaction.objectStore("accounts").put(accountRecord());
        throw new Error("Intentional atomic rollback.");
      })
      .catch(() => undefined);
  } finally {
    await ledger.close();
  }
}

async function interruptOpfsWrite(filename: string): Promise<void> {
  const ledger = await openOpfsLedger({ filename });
  try {
    await ledger.repository
      .runAtomically(async () => {
        await ledger.database.execute(
          "INSERT INTO accounts (id, name, type, institution, currency, parent_account_id, opening_balance_minor, is_archived) VALUES ('rollback-account', 'Conto rollback sintetico', 'checking', NULL, 'EUR', NULL, '0', 0);",
        );
        throw new Error("Intentional atomic rollback.");
      })
      .catch(() => undefined);
  } finally {
    await ledger.close();
  }
}

function accountRecord(): Record<string, string | number | null> {
  return {
    id: "rollback-account",
    name: "Conto rollback sintetico",
    type: "checking",
    institution: null,
    currency: "EUR",
    parent_account_id: null,
    opening_balance_minor: "0",
    is_archived: 0,
  };
}

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB cleanup failed."));
    request.onblocked = () => reject(new Error("IndexedDB cleanup blocked."));
  });
}

async function removeOpfsDirectory(filename: string): Promise<void> {
  const directory = filename.split("/").filter(Boolean)[0];
  if (directory === undefined) throw new Error("The OPFS rollback filename has no directory.");
  await (await navigator.storage.getDirectory()).removeEntry(directory, { recursive: true });
}
