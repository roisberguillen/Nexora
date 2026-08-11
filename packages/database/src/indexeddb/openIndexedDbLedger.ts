import { PersistenceError } from "../sqlite/PersistenceError";
import { databaseMigrations } from "../migrations/0001-initial-ledger-schema";
import { IndexedDbLedgerRepository } from "./IndexedDbLedgerRepository";

export const INDEXED_DB_SCHEMA_VERSION = 19;
export const PORTABLE_LEDGER_SCHEMA_VERSION = databaseMigrations.at(-1)?.version ?? 0;

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
  readonly portableSchemaVersion: number;
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
    portableSchemaVersion: PORTABLE_LEDGER_SCHEMA_VERSION,
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
      if (event.oldVersion < 4) {
        database.createObjectStore("import_batches", { keyPath: "id" });
        const importRows = database.createObjectStore("import_rows", { keyPath: "id" });
        importRows.createIndex("by_batch_id", "batch_id", { unique: false });
        importRows.createIndex("by_batch_status", ["batch_id", "status"], { unique: false });
        if (event.oldVersion > 0) {
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
        }
      }
      if (event.oldVersion < 5) {
        const recurringRules = database.createObjectStore("recurring_rules", { keyPath: "id" });
        recurringRules.createIndex("by_due_date", ["enabled", "next_expected_date"], {
          unique: false,
        });
        recurringRules.createIndex("by_account_id", "account_id", { unique: false });
        if (event.oldVersion > 0) {
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
        }
      }
      if (event.oldVersion < 6) {
        const allocationPlans = database.createObjectStore("allocation_plans", { keyPath: "id" });
        allocationPlans.createIndex("by_trigger", ["trigger_kind", "enabled"], { unique: false });
        if (event.oldVersion > 0)
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
      }
      if (event.oldVersion < 7) {
        const budgets = database.createObjectStore("budgets", { keyPath: "id" });
        budgets.createIndex("by_period", "period", { unique: false });
        if (event.oldVersion > 0)
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
      }
      if (event.oldVersion < 8) {
        const loans = database.createObjectStore("loans", { keyPath: "id" });
        loans.createIndex("by_next_due_date", "next_due_date", { unique: false });
        if (event.oldVersion > 0)
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
      }
      if (event.oldVersion < 9) {
        const positions = database.createObjectStore("investment_positions", { keyPath: "id" });
        positions.createIndex("by_account", "account_id", { unique: false });
        if (event.oldVersion > 0)
          transaction
            .objectStore("metadata")
            .put({ key: "schema_version", value: INDEXED_DB_SCHEMA_VERSION });
      }
      if (event.oldVersion < 10 && event.oldVersion > 0) {
        transaction.objectStore("metadata").put({
          key: "schema_version",
          value: INDEXED_DB_SCHEMA_VERSION,
        });
      }
      if (event.oldVersion < 11) {
        const monthlyJournals = database.createObjectStore("monthly_journals", {
          keyPath: "id",
        });
        monthlyJournals.createIndex("by_period", "period", { unique: true });
        if (event.oldVersion > 0) {
          transaction.objectStore("metadata").put({
            key: "schema_version",
            value: INDEXED_DB_SCHEMA_VERSION,
          });
        }
      }
      if (event.oldVersion < 12) {
        const trash = database.createObjectStore("transaction_trash", {
          keyPath: "transaction_id",
        });
        trash.createIndex("by_deleted_at", "deleted_at", { unique: false });
        if (event.oldVersion > 0) {
          transaction.objectStore("metadata").put({
            key: "schema_version",
            value: INDEXED_DB_SCHEMA_VERSION,
          });
        }
      }
      if (event.oldVersion < 13 && event.oldVersion > 0) {
        transaction.objectStore("metadata").put({
          key: "schema_version",
          value: INDEXED_DB_SCHEMA_VERSION,
        });
      }
      if (event.oldVersion < 14 && event.oldVersion > 0) {
        transaction.objectStore("metadata").put({
          key: "schema_version",
          value: INDEXED_DB_SCHEMA_VERSION,
        });
      }
      if (event.oldVersion < 15 && event.oldVersion > 0) {
        transaction.objectStore("metadata").put({
          key: "schema_version",
          value: INDEXED_DB_SCHEMA_VERSION,
        });
      }
      if (event.oldVersion < 16 && event.oldVersion > 0) {
        transaction.objectStore("metadata").put({
          key: "schema_version",
          value: INDEXED_DB_SCHEMA_VERSION,
        });
      }
      if (event.oldVersion < 17) {
        const recurringRules = transaction.objectStore("recurring_rules");
        if (!recurringRules.indexNames.contains("by_active_due_date")) {
          recurringRules.createIndex(
            "by_active_due_date",
            ["active_due_state", "next_expected_date"],
            {
              unique: false,
            },
          );
        }
        if (event.oldVersion > 0) {
          transaction.objectStore("metadata").put({
            key: "schema_version",
            value: INDEXED_DB_SCHEMA_VERSION,
          });
        }
      }
      if (event.oldVersion < 18) {
        const recurringRules = transaction.objectStore("recurring_rules");
        if (recurringRules.indexNames.contains("by_active_due_date")) {
          recurringRules.deleteIndex("by_active_due_date");
        }
        recurringRules.createIndex(
          "by_active_due_date",
          ["active_due_state", "next_expected_date"],
          { unique: false },
        );
        backfillRecurringRuleActiveDueState(recurringRules, transaction);
        if (event.oldVersion > 0) {
          transaction.objectStore("metadata").put({
            key: "schema_version",
            value: INDEXED_DB_SCHEMA_VERSION,
          });
        }
      }
      if (event.oldVersion < 19 && event.oldVersion > 0) {
        // Record properties are additive, but opening a new physical version guarantees that
        // persisted v18 ledgers are validated by the same release as SQLite migration 0019.
        transaction.objectStore("metadata").put({
          key: "schema_version",
          value: INDEXED_DB_SCHEMA_VERSION,
        });
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

function backfillRecurringRuleActiveDueState(
  recurringRules: IDBObjectStore,
  transaction: IDBTransaction,
): void {
  const cursorRequest = recurringRules.openCursor();
  cursorRequest.onerror = () => transaction.abort();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor === null) {
      return;
    }
    const record = cursor.value as Record<string, unknown>;
    const activeDueState =
      record.enabled === true && record.retired_at === undefined ? "active" : "inactive";
    const updateRequest = cursor.update({ ...record, active_due_state: activeDueState });
    updateRequest.onerror = () => transaction.abort();
    updateRequest.onsuccess = () => cursor.continue();
  };
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
    "import_batches",
    "import_rows",
    "recurring_rules",
    "allocation_plans",
    "budgets",
    "loans",
    "investment_positions",
    "monthly_journals",
    "transaction_trash",
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
