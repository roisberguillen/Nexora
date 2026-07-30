// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { issuePairingGrant } from "@nexora/domain";

import { createLocalSyncHost } from "./LocalSyncHost";

const servers: Array<ReturnType<typeof createLocalSyncHost>> = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

describe("local sync host", () => {
  it("serves health and protects ledger metadata with pairing, origin and rate limits", async () => {
    const fingerprint = `sha256:${"a".repeat(64)}`;
    const grant = issuePairingGrant({ deviceId: "phone-001", hostFingerprint: fingerprint, now: new Date(), randomToken: () => "x".repeat(32) });
    const server = createLocalSyncHost({ policy: { binding: "lan", lanConsent: true, allowedOrigins: ["https://nexora.local"] }, hostFingerprint: fingerprint, resolveGrant: (token) => token === grant.token ? grant : undefined, ledgerMetadata: () => ({ ledgerId: "ledger", schemaVersion: 13, updatedAt: "2026-07-30T00:00:00.000Z" }) });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("missing address");
    const url = `http://127.0.0.1:${address.port}`;
    expect((await fetch(`${url}/v1/health`)).status).toBe(200);
    expect((await fetch(`${url}/v1/ledger`)).status).toBe(401);
    expect((await fetch(`${url}/v1/ledger`, { headers: { Origin: "https://nexora.local", Authorization: `Bearer ${grant.token}`, "X-Nexora-Device-Id": "phone-001" } })).status).toBe(200);
    expect((await fetch(`${url}/v1/ledger`, { headers: { Origin: "https://evil.example", Authorization: `Bearer ${grant.token}`, "X-Nexora-Device-Id": "phone-001" } })).status).toBe(403);
  });
});
