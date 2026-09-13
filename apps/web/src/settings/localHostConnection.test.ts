import { describe, expect, it, vi } from "vitest";

import {
  configureLocalHostPasscode,
  createLocalHostDeviceCredentials,
  logoutLocalHostSession,
  probeLocalHost,
  parseLocalHostPairingInvite,
  redeemLocalHostPairing,
  readLocalHostConnection,
  revokeLocalHostDevice,
  unlockLocalHostSession,
  writeLocalHostConnection,
} from "./localHostConnection";

describe("local host connection", () => {
  it("parses a pairing invite without accepting secrets in an arbitrary shape", () => {
    expect(
      parseLocalHostPairingInvite(
        JSON.stringify({
          endpoint: "http://127.0.0.1:43173",
          grantId: "grant-12345678",
          code: "code-12345678",
          hostFingerprint: "loopback",
        }),
      ),
    ).toEqual({
      endpoint: "http://127.0.0.1:43173",
      grantId: "grant-12345678",
      code: "code-12345678",
      hostFingerprint: "loopback",
    });
    expect(() => parseLocalHostPairingInvite("{}")).toThrow("invalid_pairing_invite");
  });

  it("creates a high-entropy device token without persisting it", () => {
    const credentials = createLocalHostDeviceCredentials("pixel-9-test");
    expect(credentials.deviceId).toBe("pixel-9-test");
    expect(credentials.deviceToken).toMatch(/^[0-9a-f]{48}$/);
    expect(localStorage.getItem("nexora.local-host-connection.v1")).toBeNull();
  });

  it("persists only a valid local host connection", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    writeLocalHostConnection(
      {
        enabled: true,
        endpoint: "http://192.168.1.20:43173",
        appUrl: "https://nexora.home",
        runtimeState: "running",
      },
      storage,
    );
    expect(readLocalHostConnection(storage)).toEqual({
      enabled: true,
      endpoint: "http://192.168.1.20:43173",
      appUrl: "https://nexora.home",
      runtimeState: "running",
    });
  });

  it("accepts an advertised app URL only from a healthy host", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            apiVersion: 1,
            appUrl: "https://nexora.home",
            runtimeState: "running",
            binding: "lan",
            address: "192.168.1.20:43173",
          }),
          { status: 200 },
        ),
    );
    await expect(probeLocalHost("https://host.home", request)).resolves.toEqual({
      apiVersion: 1,
      appUrl: "https://nexora.home",
      runtimeState: "running",
      binding: "lan",
      address: "192.168.1.20:43173",
    });
    expect(request).toHaveBeenCalledWith("https://host.home/v1/health", { cache: "no-store" });
  });

  it("accepts the Local Hub wire health response in snake_case", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          api_version: 1,
          status: "ok",
          app_url: "https://10.2.32.159:43173/",
          runtime_state: "running",
          binding: "lan",
          address: "10.2.32.159:43173",
          sync_state: "idle",
          sync_cursor: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(probeLocalHost("https://10.2.32.159:43173", request)).resolves.toEqual({
      apiVersion: 1,
      appUrl: "https://10.2.32.159:43173/",
      runtimeState: "running",
      binding: "lan",
      address: "10.2.32.159:43173",
      syncState: "idle",
      syncCursor: 0,
    });
  });

  it("does not persist an app URL until the host health response advertises it", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ status: "ok", apiVersion: 1, runtimeState: "stopped", binding: "lan" }),
          { status: 200 },
        ),
    );
    await expect(probeLocalHost("https://host.home", request)).rejects.toThrow(
      "invalid_host_response",
    );
  });

  it("rejects an incompatible Local Hub protocol version", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ status: "ok", apiVersion: 2, runtimeState: "running", binding: "lan" }),
          { status: 200 },
        ),
    );
    await expect(probeLocalHost("https://host.home", request)).rejects.toThrow(
      "host_protocol_version_mismatch",
    );
  });

  it("sends session credentials ephemerally and never stores the session token", async () => {
    const request = vi.fn(
      async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    );
    const credentials = { deviceId: "browser-1", deviceToken: "device-token-123456789" };
    await configureLocalHostPasscode(
      "https://host.home/",
      credentials,
      "4937",
      new Uint8Array([1, 2, 3]),
      request,
    );
    await expect(
      unlockLocalHostSession(
        "https://host.home/",
        credentials,
        "4937",
        "session-token-123456789",
        60_000,
        request,
      ),
    ).resolves.toBe("session-token-123456789");
    await logoutLocalHostSession(
      "https://host.home/",
      credentials.deviceId,
      "session-token-123456789",
      request,
    );
    expect(request).toHaveBeenCalledTimes(3);
    expect(JSON.stringify([...request.mock.calls])).toContain("device-token-123456789");
    expect(localStorage.getItem("nexora.local-host-connection.v1")).toBeNull();
  });

  it("redeems pairing without persisting secrets and can revoke a device", async () => {
    const request = vi.fn(async () => new Response(null, { status: 204 }));
    const pairing = {
      grantId: "grant-1",
      code: "qr-code-1",
      deviceId: "browser-1",
      deviceToken: "device-token-123456789",
      hostFingerprint: "sha256:host",
    };
    await expect(redeemLocalHostPairing("https://host.home/", pairing, request)).resolves.toEqual({
      deviceId: "browser-1",
      deviceToken: "device-token-123456789",
    });
    await revokeLocalHostDevice(
      "https://host.home/",
      { deviceId: "browser-1", deviceToken: "device-token-123456789" },
      "browser-1",
      request,
    );
    expect(request).toHaveBeenNthCalledWith(
      1,
      "https://host.home/v1/pairing/redeem",
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "https://host.home/v1/pairing/revoke",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.stringify([...request.mock.calls])).toContain("sha256:host");
    expect(localStorage.getItem("nexora.local-host-connection.v1")).toBeNull();
  });
});
