import { describe, expect, it, vi } from "vitest";

import {
  configureLocalHostPasscode,
  logoutLocalHostSession,
  probeLocalHost,
  readLocalHostConnection,
  unlockLocalHostSession,
  writeLocalHostConnection,
} from "./localHostConnection";

describe("local host connection", () => {
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
});
