// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { issuePairingGrant, SyncOperationLog } from "@nexora/domain";

import { createLocalSyncHost, startLocalSyncHost } from "./LocalSyncHost";

const servers: Array<ReturnType<typeof createLocalSyncHost>> = [];
afterEach(async () =>
  Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  ),
);

describe("local sync host", () => {
  it("serves health and protects ledger metadata with pairing, origin and rate limits", async () => {
    const fingerprint = `sha256:${"a".repeat(64)}`;
    const grant = issuePairingGrant({
      deviceId: "phone-001",
      hostFingerprint: fingerprint,
      now: new Date(),
      randomToken: () => "x".repeat(32),
    });
    const server = createLocalSyncHost({
      policy: { binding: "lan", lanConsent: true, allowedOrigins: ["https://nexora.local"] },
      hostFingerprint: fingerprint,
      resolveGrant: (token) => (token === grant.token ? grant : undefined),
      ledgerMetadata: () => ({
        ledgerId: "ledger",
        schemaVersion: 13,
        updatedAt: "2026-07-30T00:00:00.000Z",
      }),
      operationLog: new SyncOperationLog(),
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("missing address");
    const url = `http://127.0.0.1:${address.port}`;
    expect(await (await fetch(`${url}/v1/health`)).json()).toEqual({ status: "ok", apiVersion: 1 });
    expect((await fetch(`${url}/v1/ledger`)).status).toBe(401);
    expect(
      (
        await fetch(`${url}/v1/ledger`, {
          headers: {
            Origin: "https://nexora.local",
            Authorization: `Bearer ${grant.token}`,
            "X-Nexora-Device-Id": "phone-001",
          },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${url}/v1/ledger`, {
          headers: {
            Origin: "https://evil.example",
            Authorization: `Bearer ${grant.token}`,
            "X-Nexora-Device-Id": "phone-001",
          },
        })
      ).status,
    ).toBe(403);
    const headers = {
      Origin: "https://nexora.local",
      Authorization: `Bearer ${grant.token}`,
      "X-Nexora-Device-Id": "phone-001",
      "Content-Type": "application/json",
    };
    const operation = {
      idempotencyKey: "op-001",
      entityId: "transaction-1",
      baseRevision: 0,
      payloadDigest: "sha256:one",
      createdAt: "2026-07-30T00:00:00.000Z",
    };
    expect(
      await (
        await fetch(`${url}/v1/operations`, {
          method: "POST",
          headers,
          body: JSON.stringify(operation),
        })
      ).json(),
    ).toEqual({ status: "applied", cursor: 1, revision: 1 });
    expect(
      await (
        await fetch(`${url}/v1/operations`, {
          method: "POST",
          headers,
          body: JSON.stringify(operation),
        })
      ).json(),
    ).toEqual({ status: "duplicate", cursor: 1, revision: 1 });
    expect(await (await fetch(`${url}/v1/operations?cursor=0`, { headers })).json()).toEqual({
      operations: [{ cursor: 1, operation, revision: 1 }],
    });
  });

  it("does not expose a LAN listener until TLS configuration exists", async () => {
    await expect(
      startLocalSyncHost({
        policy: { binding: "lan", lanConsent: true, allowedOrigins: ["https://nexora.local"] },
        hostFingerprint: `sha256:${"a".repeat(64)}`,
        resolveGrant: () => undefined,
        ledgerMetadata: () => ({
          ledgerId: "ledger",
          schemaVersion: 13,
          updatedAt: "2026-07-30T00:00:00.000Z",
        }),
      }),
    ).rejects.toThrow("lan_tls_configuration_required");
  });

  it("limits requests from one device", async () => {
    const fingerprint = `sha256:${"a".repeat(64)}`;
    const grant = issuePairingGrant({
      deviceId: "phone-001",
      hostFingerprint: fingerprint,
      now: new Date(),
      randomToken: () => "x".repeat(32),
    });
    const server = createLocalSyncHost({
      policy: { binding: "loopback", lanConsent: false, allowedOrigins: ["http://localhost"] },
      hostFingerprint: fingerprint,
      resolveGrant: () => grant,
      ledgerMetadata: () => ({
        ledgerId: "ledger",
        schemaVersion: 13,
        updatedAt: "2026-07-30T00:00:00.000Z",
      }),
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("missing address");
    const headers = {
      Origin: "http://localhost",
      Authorization: `Bearer ${grant.token}`,
      "X-Nexora-Device-Id": "phone-001",
    };
    const responses = await Promise.all(
      Array.from({ length: 61 }, () =>
        fetch(`http://127.0.0.1:${address.port}/v1/ledger`, { headers }),
      ),
    );
    expect(responses.at(-1)?.status).toBe(429);
  });
});
