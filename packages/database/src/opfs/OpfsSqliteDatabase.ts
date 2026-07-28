import { PersistenceError } from "../sqlite/PersistenceError";
import type { PhysicalSqliteDatabase, SqliteValue } from "../sqlite/SqliteDatabase";
import {
  isOpfsWorkerResponse,
  type OpfsWorkerRequestWithoutId,
  type OpfsWorkerSuccessResponse,
} from "./OpfsWorkerProtocol";

export interface OpenOpfsSqliteDatabaseOptions {
  readonly filename?: string;
  readonly requestTimeoutMs?: number;
}

export interface OpfsWorkerPort {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown, transfer?: readonly Transferable[]): void;
  terminate(): void;
}

interface PendingRequest {
  readonly resolve: (response: OpfsWorkerSuccessResponse) => void;
  readonly reject: (error: PersistenceError) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const defaultFilename = "/nexora/nexora.sqlite3";
const defaultRequestTimeoutMs = 30_000;
const filenamePattern = /^\/[A-Za-z0-9._/-]+$/;

export async function openOpfsSqliteDatabase(
  options: OpenOpfsSqliteDatabaseOptions = {},
): Promise<PhysicalSqliteDatabase> {
  if (!isOpfsSqliteSupported()) {
    throw new PersistenceError(
      "opfs_unavailable",
      "SQLite OPFS is not available in this browser context.",
    );
  }

  const worker = new Worker(new URL("./opfs.worker.ts", import.meta.url), {
    type: "module",
    name: "nexora-sqlite-opfs",
  });
  const client = new OpfsSqliteDatabaseClient(
    worker,
    options.requestTimeoutMs ?? defaultRequestTimeoutMs,
  );

  try {
    await client.open(options.filename ?? defaultFilename);
    return client;
  } catch (cause) {
    client.terminate();
    throw cause;
  }
}

export function isOpfsSqliteSupported(): boolean {
  return (
    typeof Worker !== "undefined" &&
    globalThis.crossOriginIsolated === true &&
    typeof globalThis.SharedArrayBuffer !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.storage !== undefined &&
    typeof navigator.storage.getDirectory === "function"
  );
}

export class OpfsSqliteDatabaseClient implements PhysicalSqliteDatabase {
  public readonly storageKind = "opfs" as const;

  private readonly pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;
  private isClosed = false;

  public constructor(
    private readonly worker: OpfsWorkerPort,
    private readonly requestTimeoutMs = defaultRequestTimeoutMs,
  ) {
    if (
      !Number.isInteger(requestTimeoutMs) ||
      requestTimeoutMs < 1_000 ||
      requestTimeoutMs > 120_000
    ) {
      throw new PersistenceError("worker_failed", "The SQLite worker timeout is invalid.");
    }

    this.worker.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = () => {
      this.failAll("The SQLite worker stopped unexpectedly.");
    };
    this.worker.onmessageerror = () => {
      this.failAll("The SQLite worker returned an unreadable response.");
    };
  }

  public async open(filename: string): Promise<void> {
    validateFilename(filename);
    await this.send({ type: "open", filename });
  }

  public async execute(sql: string): Promise<void> {
    validateSql(sql);
    await this.send({ type: "execute", sql });
  }

  public async query<Row extends object>(
    sql: string,
    parameters: readonly SqliteValue[] = [],
  ): Promise<readonly Row[]> {
    validateSql(sql);
    const response = await this.send({
      type: "query",
      sql,
      parameters,
    });
    return (response.rows ?? []) as unknown as readonly Row[];
  }

  public async run(sql: string, parameters: readonly SqliteValue[] = []): Promise<void> {
    validateSql(sql);
    await this.send({ type: "run", sql, parameters });
  }

  public async exportDatabase(): Promise<Uint8Array> {
    const response = await this.send({ type: "export" });
    if (response.bytes === undefined) {
      throw new PersistenceError(
        "worker_failed",
        "The SQLite worker did not return the exported database.",
      );
    }
    return response.bytes;
  }

  public async restoreDatabase(bytes: Uint8Array, expectedSchemaVersion: number): Promise<void> {
    validateDatabaseBytes(bytes);
    if (!Number.isInteger(expectedSchemaVersion) || expectedSchemaVersion < 0) {
      throw new PersistenceError(
        "restore_failed",
        "The expected SQLite schema version is invalid.",
      );
    }
    const transferableBytes = bytes.slice();
    await this.send(
      {
        type: "restore",
        bytes: transferableBytes,
        expectedSchemaVersion,
      },
      [transferableBytes.buffer],
    );
  }

  public async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    try {
      await this.send({ type: "close" });
    } finally {
      this.isClosed = true;
      this.worker.terminate();
      this.rejectPending(
        new PersistenceError("persistence_closed", "The SQLite OPFS connection is closed."),
      );
    }
  }

  public terminate(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.worker.terminate();
    this.rejectPending(
      new PersistenceError("persistence_closed", "The SQLite OPFS connection is closed."),
    );
  }

  private send(
    request: OpfsWorkerRequestWithoutId,
    transfer: readonly Transferable[] = [],
  ): Promise<OpfsWorkerSuccessResponse> {
    if (this.isClosed) {
      return Promise.reject(
        new PersistenceError("persistence_closed", "The SQLite OPFS connection is closed."),
      );
    }

    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<OpfsWorkerSuccessResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.failAll("The SQLite worker did not respond in time.");
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.worker.postMessage({ ...request, id }, transfer);
      } catch (cause) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(
          new PersistenceError(
            "worker_failed",
            "The SQLite worker request could not be sent.",
            cause,
          ),
        );
      }
    });
  }

  private handleMessage(value: unknown): void {
    if (!isOpfsWorkerResponse(value)) {
      this.failAll("The SQLite worker returned an invalid response.");
      return;
    }

    const pending = this.pending.get(value.id);
    if (pending === undefined) {
      return;
    }
    this.pending.delete(value.id);
    clearTimeout(pending.timeout);

    if (value.ok) {
      pending.resolve(value);
      return;
    }

    pending.reject(
      new PersistenceError(
        value.code,
        value.code === "opfs_unavailable"
          ? "SQLite OPFS is not available in this browser context."
          : value.code === "restore_failed"
            ? "The SQLite OPFS restore failed; the previous database was preserved when possible."
            : "The SQLite worker operation failed.",
      ),
    );
  }

  private failAll(message: string): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.worker.terminate();
    this.rejectPending(new PersistenceError("worker_failed", message));
  }

  private rejectPending(error: PersistenceError): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function validateFilename(filename: string): void {
  if (
    filename.length < 2 ||
    filename.length > 240 ||
    !filenamePattern.test(filename) ||
    filename.includes("..") ||
    filename.includes("//") ||
    !filename.endsWith(".sqlite3")
  ) {
    throw new PersistenceError("worker_failed", "The SQLite OPFS filename is invalid.");
  }
}

function validateSql(sql: string): void {
  if (sql.trim().length === 0) {
    throw new PersistenceError("worker_failed", "A SQLite operation requires a SQL statement.");
  }
}

function validateDatabaseBytes(bytes: Uint8Array): void {
  const maxDatabaseBytes = 512 * 1024 * 1024;
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < 100 ||
    bytes.byteLength > maxDatabaseBytes
  ) {
    throw new PersistenceError("restore_failed", "The SQLite restore payload has an invalid size.");
  }
}
