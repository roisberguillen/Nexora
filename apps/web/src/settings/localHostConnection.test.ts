import { describe, expect, it, vi } from "vitest";

import {
  probeLocalHost,
  readLocalHostConnection,
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
});
