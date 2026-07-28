/// <reference lib="webworker" />

import sqlite3InitModule, {
  type Database,
  type Sqlite3Static,
  type SqlValue,
} from "@sqlite.org/sqlite-wasm";

import type { OpfsWorkerRequest, OpfsWorkerResponse } from "./OpfsWorkerProtocol";
import type { SqliteValue } from "../sqlite/SqliteDatabase";

let database: Database | undefined;
let databaseFilename: string | undefined;
let sqlite3: Sqlite3Static | undefined;
let requestQueue: Promise<void> = Promise.resolve();

globalThis.addEventListener("message", (event: MessageEvent<OpfsWorkerRequest>) => {
  const request = event.data;
  requestQueue = requestQueue.then(
    () => handleRequest(request),
    () => handleRequest(request),
  );
});

async function handleRequest(request: OpfsWorkerRequest): Promise<void> {
  try {
    switch (request.type) {
      case "open":
        await openDatabase(request.filename);
        respond({ id: request.id, ok: true });
        return;
      case "execute":
        requireDatabase().exec(request.sql);
        respond({ id: request.id, ok: true });
        return;
      case "query": {
        const rows = requireDatabase().exec({
          sql: request.sql,
          bind: request.parameters,
          rowMode: "object",
          returnValue: "resultRows",
        });
        respond({
          id: request.id,
          ok: true,
          rows: rows.map(normalizeRow),
        });
        return;
      }
      case "run":
        requireDatabase().exec({
          sql: request.sql,
          bind: request.parameters,
        });
        respond({ id: request.id, ok: true });
        return;
      case "export": {
        const bytes = exportDatabase();
        respond({ id: request.id, ok: true, bytes }, [bytes.buffer]);
        return;
      }
      case "restore":
        await restoreDatabase(request.bytes, request.expectedSchemaVersion);
        respond({ id: request.id, ok: true });
        return;
      case "close":
        database?.close();
        database = undefined;
        databaseFilename = undefined;
        respond({ id: request.id, ok: true });
        return;
    }
  } catch (cause) {
    respond({
      id: request.id,
      ok: false,
      code:
        cause instanceof OpfsUnavailableError
          ? "opfs_unavailable"
          : request.type === "restore"
            ? "restore_failed"
            : "worker_failed",
    });
  }
}

async function openDatabase(filename: string): Promise<void> {
  if (database !== undefined) {
    throw new Error("Database is already open.");
  }
  if (
    globalThis.crossOriginIsolated !== true ||
    typeof globalThis.SharedArrayBuffer === "undefined"
  ) {
    throw new OpfsUnavailableError();
  }

  sqlite3 ??= await sqlite3InitModule();
  if (typeof sqlite3.oo1.OpfsDb !== "function") {
    throw new OpfsUnavailableError();
  }

  database = createDatabaseHandle(sqlite3, filename);
  databaseFilename = filename;
}

function requireDatabase(): Database {
  if (database === undefined) {
    throw new Error("Database is not open.");
  }
  return database;
}

function requireSqlite(): Sqlite3Static {
  if (sqlite3 === undefined) {
    throw new Error("SQLite is not initialized.");
  }
  return sqlite3;
}

function requireDatabaseFilename(): string {
  if (databaseFilename === undefined) {
    throw new Error("Database filename is not available.");
  }
  return databaseFilename;
}

function exportDatabase(): Uint8Array<ArrayBuffer> {
  const activeDatabase = requireDatabase();
  assertDatabaseIntegrity(activeDatabase);
  return requireSqlite().capi.sqlite3_js_db_export(activeDatabase);
}

async function restoreDatabase(bytes: Uint8Array, expectedSchemaVersion: number): Promise<void> {
  validateDatabaseBytes(bytes);
  if (!Number.isInteger(expectedSchemaVersion) || expectedSchemaVersion < 0) {
    throw new Error("Expected SQLite schema version is invalid.");
  }
  const engine = requireSqlite();
  const filename = requireDatabaseFilename();
  const serializedSchemaVersion = validateSerializedDatabase(engine, bytes);
  if (serializedSchemaVersion !== expectedSchemaVersion) {
    throw new Error("SQLite restore schema does not match the manifest.");
  }
  const rollbackBytes = exportDatabase();

  requireDatabase().close();
  database = undefined;

  try {
    await engine.oo1.OpfsDb.importDb(filename, bytes);
    database = createDatabaseHandle(engine, filename);
    assertDatabaseIntegrity(database);
  } catch (cause) {
    database?.close();
    database = undefined;
    try {
      await engine.oo1.OpfsDb.importDb(filename, rollbackBytes);
      database = createDatabaseHandle(engine, filename);
      assertDatabaseIntegrity(database);
    } catch {
      // The caller receives a restore failure even if emergency rollback also fails.
    }
    throw cause;
  }
}

function validateSerializedDatabase(engine: Sqlite3Static, bytes: Uint8Array): number {
  const pointer = engine.wasm.allocFromTypedArray(bytes);
  let validationDatabase: Database | undefined;
  let pointerOwnedByDatabase = false;

  try {
    validationDatabase = new engine.oo1.DB();
    const resultCode = engine.capi.sqlite3_deserialize(
      validationDatabase,
      "main",
      pointer,
      bytes.byteLength,
      bytes.byteLength,
      engine.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
    );
    pointerOwnedByDatabase = resultCode === engine.capi.SQLITE_OK;
    validationDatabase.checkRc(resultCode);
    assertDatabaseIntegrity(validationDatabase);
    return readSchemaVersion(validationDatabase);
  } finally {
    validationDatabase?.close();
    if (!pointerOwnedByDatabase) {
      engine.wasm.dealloc(pointer);
    }
  }
}

function readSchemaVersion(activeDatabase: Database): number {
  const migrationTable = activeDatabase.selectValue(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'table' AND name = 'schema_migrations'
  `);
  if (migrationTable === undefined) {
    return 0;
  }
  const version = activeDatabase.selectValue("SELECT MAX(version) FROM schema_migrations;");
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new Error("SQLite schema version is invalid.");
  }
  return version;
}

function createDatabaseHandle(engine: Sqlite3Static, filename: string): Database {
  const opened = new engine.oo1.OpfsDb(filename, "c");
  opened.exec("PRAGMA busy_timeout = 5000;");
  return opened;
}

function assertDatabaseIntegrity(activeDatabase: Database): void {
  if (activeDatabase.selectValue("PRAGMA integrity_check;") !== "ok") {
    throw new Error("SQLite integrity check failed.");
  }
}

function validateDatabaseBytes(bytes: Uint8Array): void {
  const maxDatabaseBytes = 512 * 1024 * 1024;
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < 100 ||
    bytes.byteLength > maxDatabaseBytes
  ) {
    throw new Error("SQLite restore payload has an invalid size.");
  }
}

function respond(response: OpfsWorkerResponse, transfer: Transferable[] = []): void {
  globalThis.postMessage(response, transfer);
}

function normalizeRow(row: Record<string, SqlValue>): Record<string, SqliteValue> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]),
  );
}

function normalizeValue(value: SqlValue): SqliteValue {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (value instanceof Int8Array) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return value;
}

class OpfsUnavailableError extends Error {}
