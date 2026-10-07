import { describe, expect, it, vi } from "vitest";

import { LocalHostSyncClient, type LocalSyncOperation } from "./localHostSync";

const operation: LocalSyncOperation = {
  idempotencyKey: "op-1",
  deviceId: "browser-1",
  entityId: "transaction-1",
  baseRevision: 0,
  revision: 0,
  payloadDigest: "sha256:payload",
  payload: "synthetic-payload",
  tombstone: false,
  createdAt: "2026-09-12T00:00:00Z",
};

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("local host sync client", () => {
  it("deduplicates queued operations and flushes them with volatile credentials", async () => {
    const request = vi.fn(
      async () =>
        new Response(JSON.stringify([{ Applied: { cursor: 1, revision: 1 } }]), { status: 200 }),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://host.home/",
      credentials: { deviceId: "browser-1", token: "volatile-token" },
      storage: storage(),
      request,
      deliveryId: () => "delivery-1",
    });
    client.enqueue(operation);
    client.enqueue(operation);
    expect(client.pending()).toHaveLength(1);
    await expect(client.flush()).resolves.toEqual({ status: "applied", pendingCount: 0 });
    expect(client.pending()).toEqual([]);
    expect(request).toHaveBeenCalledWith(
      "https://host.home/v1/operations",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("delivery-1"),
        headers: expect.objectContaining({ authorization: "Bearer volatile-token" }),
      }),
    );
  });

  it("keeps the queue on network failure or conflict for a later retry", async () => {
    const values = storage();
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "conflict" }), { status: 409 }))
      .mockRejectedValueOnce(new Error("offline"));
    const client = new LocalHostSyncClient({
      endpoint: "https://host.home",
      credentials: { deviceId: "browser-1", token: "volatile-token" },
      storage: values,
      request,
      deliveryId: () => "delivery-1",
    });
    client.enqueue(operation);
    await expect(client.flush()).resolves.toEqual({ status: "conflict", pendingCount: 1 });
    expect(client.pending()).toHaveLength(1);
    await expect(client.flush()).rejects.toThrow("offline");
    expect(client.pending()).toHaveLength(1);
  });

  it("removes only applied operations when a batch contains a conflict", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { Applied: { cursor: 1, revision: 1 } },
            { Conflict: { current_revision: 2 } },
          ]),
          { status: 200 },
        ),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://host.home",
      credentials: { deviceId: "browser-1", token: "volatile-token" },
      storage: storage(),
      request,
      deliveryId: () => "delivery-2",
    });
    client.enqueue(operation);
    client.enqueue({ ...operation, idempotencyKey: "op-2", entityId: "transaction-2" });
    await expect(client.flush()).resolves.toEqual({ status: "conflict", pendingCount: 1 });
    expect(client.pending().map(({ idempotencyKey }) => idempotencyKey)).toEqual(["op-2"]);
  });

  it("bootstraps the durable operation log and rejects malformed responses", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ schema_version: 1, cursor: 3, operations: [[3, operation]] }),
          { status: 200 },
        ),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://host.home",
      credentials: { deviceId: "browser-1", token: "volatile-token" },
      storage: storage(),
      request,
    });
    await expect(client.bootstrap()).resolves.toEqual({
      schemaVersion: 1,
      cursor: 3,
      operations: [[3, operation]],
    });
  });

  it("pulls only validated cursors and sends the paired headers", async () => {
    const request = vi.fn(
      async () => new Response(JSON.stringify({ operations: [[1, operation]] }), { status: 200 }),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://host.home",
      credentials: { deviceId: "browser-1", token: "volatile-token" },
      storage: storage(),
      request,
    });
    await expect(client.pull(0)).resolves.toEqual({ operations: [[1, operation]] });
    await expect(client.pull(-1)).rejects.toThrow("invalid_sync_cursor");
    expect(request).toHaveBeenCalledWith(
      "https://host.home/v1/operations?after=0",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-nexora-device-id": "browser-1" }),
      }),
    );
  });

  it("adds the volatile session header to sync requests", async () => {
    const values = storage();
    const request = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    const client = new LocalHostSyncClient({
      endpoint: "https://host.home",
      credentials: { deviceId: "device-1", token: "device-token", sessionToken: "session-token" },
      storage: values,
      request,
    });
    await client.flush();
    expect(request).not.toHaveBeenCalled();
    client.enqueue({ ...operation, idempotencyKey: "session-op" });
    await client.flush();
    const init = (request.mock.calls as unknown[][])[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toMatchObject({
      "x-nexora-session-token": "session-token",
    });
  });
});
