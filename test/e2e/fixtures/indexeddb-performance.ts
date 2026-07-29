import { openIndexedDbLedger } from "../../../packages/database/src";
import { Account, Category } from "../../../packages/domain/src";

const transactionCount = 100_000;

export interface IndexedDbPerformanceResult {
  readonly insertedRecords: number;
  readonly listedRecords: number;
  readonly openMs: number;
  readonly insertMs: number;
  readonly reopenMs: number;
  readonly listMs: number;
}

export async function runIndexedDbPerformanceTest(
  databaseName: string,
): Promise<IndexedDbPerformanceResult> {
  const openedAt = performance.now();
  const initialLedger = await openIndexedDbLedger({ databaseName });
  const openMs = elapsedSince(openedAt);

  try {
    await initialLedger.repository.saveAccount(
      Account.create({
        id: "performance-account",
        name: "Conto sintetico performance",
        type: "checking",
        currency: "EUR",
      }),
    );
    await initialLedger.repository.saveCategory(
      Category.create({
        id: "performance-category",
        name: "Categoria sintetica performance",
        kindScope: "expense",
      }),
    );

    const insertStartedAt = performance.now();
    await insertTransactionRecords(initialLedger.database);
    const insertMs = elapsedSince(insertStartedAt);
    await initialLedger.close();

    const reopenStartedAt = performance.now();
    const reopenedLedger = await openIndexedDbLedger({ databaseName });
    const reopenMs = elapsedSince(reopenStartedAt);
    try {
      const listStartedAt = performance.now();
      const transactions = await reopenedLedger.repository.listTransactions();
      const listMs = elapsedSince(listStartedAt);

      if (transactions.length !== transactionCount) {
        throw new Error(
          `Expected ${transactionCount} persisted transactions, found ${transactions.length}.`,
        );
      }

      return {
        insertedRecords: transactionCount,
        listedRecords: transactions.length,
        openMs,
        insertMs,
        reopenMs,
        listMs,
      };
    } finally {
      await reopenedLedger.close();
    }
  } finally {
    await deleteDatabase(databaseName);
  }
}

function insertTransactionRecords(database: IDBDatabase): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("transactions", "readwrite");
    const store = transaction.objectStore("transactions");
    for (let index = 0; index < transactionCount; index += 1) {
      store.put({
        id: `performance-transaction-${index}`,
        kind: "expense",
        status: "booked",
        account_id: "performance-account",
        amount_minor: "-100",
        currency: "EUR",
        booked_date: `2026-${String((index % 12) + 1).padStart(2, "0")}-15`,
        value_date: null,
        payee: null,
        description: "Synthetic performance transaction",
        category_id: "performance-category",
        note: null,
        source: "system",
        import_batch_id: null,
        source_fingerprint: null,
      });
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB insert failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB insert aborted."));
  });
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB cleanup failed."));
    request.onblocked = () => reject(new Error("IndexedDB cleanup is blocked."));
  });
}

function elapsedSince(startedAt: number): number {
  return Number((performance.now() - startedAt).toFixed(2));
}
