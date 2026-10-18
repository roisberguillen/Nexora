import { afterEach, describe, expect, it, vi } from "vitest";

import { loadRemoteLedgerCredentials } from "./remoteLedgerStartup";

const endpoint = "https://192.168.1.5:43173/";
const connected = { enabled: true, endpoint } as const;
const saved = {
  endpoint,
  credentials: { deviceId: "synthetic-pc", deviceToken: "synthetic-device-token-1234567890" },
} as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("remote ledger startup selection", () => {
  it("keeps an unconfigured browser on its local ledger", async () => {
    const readCredentials = vi.fn(async () => saved);
    await expect(
      loadRemoteLedgerCredentials({ enabled: false, endpoint }, readCredentials),
    ).resolves.toBeNull();
    expect(readCredentials).not.toHaveBeenCalled();
  });

  it("uses only credentials for the configured phone endpoint", async () => {
    await expect(loadRemoteLedgerCredentials(connected, async () => saved)).resolves.toEqual(saved);
    await expect(
      loadRemoteLedgerCredentials(connected, async () => ({
        ...saved,
        endpoint: "https://other.local/",
      })),
    ).rejects.toThrow("remote_credentials_unavailable");
    await expect(loadRemoteLedgerCredentials(connected, async () => null)).rejects.toThrow(
      "remote_credentials_unavailable",
    );
  });

  it("ends a blocked credential read before the global storage timeout", async () => {
    vi.useFakeTimers();
    const blocked = loadRemoteLedgerCredentials(
      connected,
      () => new Promise(() => undefined),
      8_000,
    );
    const rejected = expect(blocked).rejects.toThrow("remote_credential_vault_timeout");
    await vi.advanceTimersByTimeAsync(8_000);
    await rejected;
  });
});
