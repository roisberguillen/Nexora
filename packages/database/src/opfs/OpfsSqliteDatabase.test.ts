import { describe, expect, it, vi } from "vitest";

import {
  isOpfsSqliteSupported,
  OpfsSqliteDatabaseClient,
  type OpfsWorkerPort,
} from "./OpfsSqliteDatabase";

type FakeResponseFactory = (message: unknown) => unknown;

class FakeWorker implements OpfsWorkerPort {
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public readonly messages: unknown[] = [];
  public isTerminated = false;

  public constructor(private readonly responseFactory: FakeResponseFactory) {}

  public postMessage(message: unknown): void {
    this.messages.push(message);
    const response = this.responseFactory(message);
    queueMicrotask(() => {
      this.onmessage?.(new MessageEvent("message", { data: response }));
    });
  }

  public terminate(): void {
    this.isTerminated = true;
  }
}

function requestId(message: unknown): number {
  if (
    typeof message !== "object" ||
    message === null ||
    !Number.isInteger((message as { readonly id?: unknown }).id)
  ) {
    throw new Error("Fake worker received an invalid request.");
  }
  return (message as { readonly id: number }).id;
}

function requestType(message: unknown): string {
  if (typeof message !== "object" || message === null) {
    throw new Error("Fake worker received an invalid request.");
  }
  const type = (message as { readonly type?: unknown }).type;
  if (typeof type !== "string") {
    throw new Error("Fake worker received an invalid request type.");
  }
  return type;
}

describe("OpfsSqliteDatabaseClient", () => {
  it("inoltra apertura, query, scritture e chiusura al worker", async () => {
    const exportedBytes = new Uint8Array(512).fill(7);
    const worker = new FakeWorker((message) => {
      const id = requestId(message);
      return requestType(message) === "query"
        ? {
            id,
            ok: true,
            rows: [{ version: 1, name: "initial-ledger-schema" }],
          }
        : requestType(message) === "export"
          ? { id, ok: true, bytes: exportedBytes }
          : { id, ok: true };
    });
    const client = new OpfsSqliteDatabaseClient(worker, 1_000);

    await client.open("/nexora-tests/client.sqlite3");
    await client.execute("PRAGMA foreign_keys = ON;");
    await client.run("INSERT INTO schema_migrations VALUES (?, ?, ?)", [
      1,
      "initial-ledger-schema",
      "2026-07-27T10:00:00.000Z",
    ]);
    await expect(
      client.query<{ readonly version: number }>("SELECT version FROM schema_migrations"),
    ).resolves.toEqual([{ version: 1, name: "initial-ledger-schema" }]);
    await expect(client.exportDatabase()).resolves.toEqual(exportedBytes);
    await client.restoreDatabase(exportedBytes, 1);
    await client.close();

    expect(worker.messages.map((message) => requestType(message))).toEqual([
      "open",
      "execute",
      "run",
      "query",
      "export",
      "restore",
      "close",
    ]);
    expect(worker.isTerminated).toBe(true);
  });

  it("propaga l'indisponibilità OPFS senza esporre l'errore interno", async () => {
    const worker = new FakeWorker((message) => ({
      id: requestId(message),
      ok: false,
      code: "opfs_unavailable",
    }));
    const client = new OpfsSqliteDatabaseClient(worker, 1_000);

    await expect(client.open("/nexora-tests/unavailable.sqlite3")).rejects.toMatchObject({
      code: "opfs_unavailable",
      message: "SQLite OPFS is not available in this browser context.",
    });
  });

  it("rifiuta nomi non confinati a un percorso OPFS assoluto", async () => {
    const worker = new FakeWorker((message) => ({
      id: requestId(message),
      ok: true,
    }));
    const client = new OpfsSqliteDatabaseClient(worker, 1_000);

    await expect(client.open("/nexora/../outside.sqlite3")).rejects.toMatchObject({
      code: "worker_failed",
    });
    expect(worker.messages).toHaveLength(0);
    client.terminate();
  });

  it("chiude la connessione quando il worker restituisce un payload non valido", async () => {
    const worker = new FakeWorker(() => ({ unexpected: true }));
    const client = new OpfsSqliteDatabaseClient(worker, 1_000);

    await expect(client.open("/nexora-tests/invalid.sqlite3")).rejects.toMatchObject({
      code: "worker_failed",
    });
    await expect(client.execute("SELECT 1")).rejects.toMatchObject({
      code: "persistence_closed",
    });
    expect(worker.isTerminated).toBe(true);
  });

  it("rende inutilizzabile la connessione dopo un timeout del worker", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker(() => undefined);
    worker.postMessage = (message: unknown) => {
      worker.messages.push(message);
    };
    const client = new OpfsSqliteDatabaseClient(worker, 1_000);

    try {
      const opening = client.open("/nexora-tests/timeout.sqlite3").catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(opening).resolves.toMatchObject({ code: "worker_failed" });
      await expect(client.execute("SELECT 1")).rejects.toMatchObject({
        code: "persistence_closed",
      });
      expect(worker.isTerminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("segnala che il contesto jsdom non supporta SQLite OPFS", () => {
    expect(isOpfsSqliteSupported()).toBe(false);
  });
});
