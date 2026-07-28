import { PersistenceError } from "../sqlite/PersistenceError";
import { IndexedDbLedgerRepository } from "./IndexedDbLedgerRepository";

export const INDEXED_DB_SCHEMA_VERSION = 3;

const defaultDatabaseName = "nexora-ledger";
const databaseNamePattern = /^[A-Za-z0-9._-]+$/;

export interface OpenIndexedDbLedgerOptions {
  readonly databaseName?: string;
  readonly factory?: IDBFactory;
}

export interface IndexedDbLedger {
  readonly database: IDBDatabase;
  readonly repository: IndexedDbLedgerRepository;
  readonly schemaVersion: number;
  readonly storageKind: "indexeddb";
  close(): Promise<void>;
}

export async function openIndexedDbLedger(
  options: OpenIndexedDbLedgerOptions = {},
): Promise<IndexedDbLedger> {
  const factory = options.factory ?? globalThis.indexedDB;
  if (factory === undefined) {
    throw new PersistenceError(
      "indexeddb_unavailable",
      "IndexedDB is not available in this browser context.",
    );
  }

  const databaseName = options.databaseName ?? defaultDatabaseName;
  validateDatabaseName(databaseName);
  const database = await openDatabase(factory, databaseName);
  try {
    await validateSchema(database);
  } catch (cause) {
    database.close();
    throw cause;
  }
  const repository = new IndexedDbLedgerRepository(database);

  database.onversionchange = () => {
    repository.close();
  };

  return {
    database,
    repository,
    schemaVersion: database.version,
    storageKind: "indexeddb",
    async close(): Promise<void> {
      repository.close();
    },
  };
}

export function isIndexedDbSupported(): boolean {
  return typeof globalThis.indexedDB !== "undefined";
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let isSettled = false;
    const rejectOnce = (error: PersistenceError): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      reject(error);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(databaseName, INDEXED_DB_SCHEMA_VERSION);
    } catch (cause) {
      rejectOnce(
        new PersistenceError(
          "indexeddb_unavailable",
          "IndexedDB could not be opened in this browser context.",
          cause,
        ),
      );
      return;
    }

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (transaction === null) {
        rejectOnce(
          new PersistenceError(
            "database_operation_failed",
            "IndexedDB did not provide an upgrade transaction.",
          ),
        );
        return;
      }

      if (event.oldVersion === 0) {
        const metadata = database.createObjectStore("metadata", { keyPath: "key" });
        database.createObjectStore("accounts", { keyPath: "id" });
        database.createObjectStore("categories", { keyPath: "id" });
        const transactions = database.createObjectStore("transactions", { keyPath: "id" });
        transactions.createIndex("by_account_id", "account_id", { unique: false });
        transactions.createIndex("by_category_id", "category_id", { unique: false });
        database.createObjectStore("transfers", { keyPath: "id" });
        metadata.add({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
      }
      if (event.oldVersion < 2) {
        const splits = database.createObjectStore("transaction_splits", { keyPath: "id" });
        splits.createIndex("by_transaction_id", "transaction_id", { unique: false });
        splits.createIndex("by_category_id", "category_id", { unique: false });
        if (event.oldVersion > 0) {
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
        }
      }
      if (event.oldVersion < 3) {
        database.createObjectStore("tags", { keyPath: "id" });
        const transactionTags = database.createObjectStore("transaction_tags", {
          keyPath: ["transaction_id", "tag_id"],
        });
        transactionTags.createIndex("by_transaction_id", "transaction_id", { unique: false });
        if (event.oldVersion > 0) {
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
        }
      }
    };
    request.onblocked = () => {
      rejectOnce(
        new PersistenceError(
          "upgrade_blocked",
          "IndexedDB schema upgrade is blocked by another open Nexora tab.",
        ),
      );
    };
    request.onerror = () => {
      rejectOnce(
        new PersistenceError(
          "database_operation_failed",
          "IndexedDB could not open the Nexora ledger.",
          request.error,
        ),
      );
    };
    request.onsuccess = () => {
      if (isSettled) {
        request.result.close();
        return;
      }
      isSettled = true;
      resolve(request.result);
    };
  });
}

async function validateSchema(database: IDBDatabase): Promise<void> {
  const requiredStores = [
    "metadata",
    "accounts",
    "categories",
    "transactions",
    "transfers",
    "transaction_splits",
    "tags",
    "transaction_tags",
  ];
  if (requiredStores.some((store) => !database.objectStoreNames.contains(store))) {
    throw new PersistenceError("corrupt_record", "The IndexedDB ledger schema is incomplete.");
  }

  try {
    const transaction = database.transaction("metadata", "readonly");
    const metadata = await new Promise<unknown>((resolve, reject) => {
      const request = transaction.objectStore("metadata").get("schema_version");
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("IndexedDB schema metadata could not be read."));
      };
    });
    if (
      typeof metadata !== "object" ||
      metadata === null ||
      !("value" in metadata) ||
      metadata.value !== INDEXED_DB_SCHEMA_VERSION
    ) {
      throw new PersistenceError(
        "corrupt_record",
        "The IndexedDB ledger schema version is invalid.",
      );
    }
  } catch (cause) {
    if (cause instanceof PersistenceError) {
      throw cause;
    }
    throw new PersistenceError(
      "database_operation_failed",
      "The IndexedDB ledger schema could not be verified.",
      cause,
    );
  }
}

function validateDatabaseName(databaseName: string): void {
  if (
    databaseName.length < 1 ||
    databaseName.length > 120 ||
    !databaseNamePattern.test(databaseName)
  ) {
    throw new PersistenceError(
      "database_operation_failed",
      "The IndexedDB database name is invalid.",
    );
  }
}
