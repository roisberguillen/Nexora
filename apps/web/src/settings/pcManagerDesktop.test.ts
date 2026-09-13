import { describe, expect, it, vi } from "vitest";

import {
  createDesktopPairingInvite,
  getDesktopLocalHubStatus,
  startDesktopLocalHub,
  startDesktopLanHub,
  stopDesktopLocalHub,
} from "./pcManagerDesktop";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri: () => true }));

describe("desktop PC Manager bridge", () => {
  it("uses the Tauri lifecycle commands", async () => {
    invoke
      .mockResolvedValueOnce({ state: "running", binding: "loopback", address: "127.0.0.1:43173" })
      .mockResolvedValueOnce({ state: "running", binding: "loopback" })
      .mockResolvedValueOnce(undefined);
    await expect(startDesktopLocalHub()).resolves.toMatchObject({ state: "running" });
    await expect(getDesktopLocalHubStatus()).resolves.toMatchObject({ binding: "loopback" });
    await expect(stopDesktopLocalHub()).resolves.toBeUndefined();
    expect(invoke).toHaveBeenNthCalledWith(1, "pc_manager_start");
    expect(invoke).toHaveBeenNthCalledWith(2, "pc_manager_status");
    expect(invoke).toHaveBeenNthCalledWith(3, "pc_manager_stop");
  });

  it("requests a short-lived pairing invite from the running desktop host", async () => {
    invoke.mockResolvedValueOnce({
      endpoint: "http://127.0.0.1:43173",
      grantId: "grant-1",
      code: "code-1",
      hostFingerprint: "loopback",
      expiresAtMs: 123,
    });
    await expect(createDesktopPairingInvite()).resolves.toMatchObject({
      grantId: "grant-1",
      hostFingerprint: "loopback",
    });
    expect(invoke).toHaveBeenCalledWith("pc_manager_create_pairing_invite");
  });

  it("passes explicit LAN TLS file selections to the native host command", async () => {
    invoke.mockResolvedValueOnce({
      state: "running",
      binding: "lan",
      address: "192.168.1.10:43173",
    });
    await expect(
      startDesktopLanHub({
        address: "192.168.1.10",
        certificatePath: "C:/cert.pem",
        privateKeyPath: "C:/key.pem",
      }),
    ).resolves.toMatchObject({ binding: "lan" });
    expect(invoke).toHaveBeenCalledWith("pc_manager_start_lan", {
      request: {
        address: "192.168.1.10",
        certificatePath: "C:/cert.pem",
        privateKeyPath: "C:/key.pem",
      },
    });
  });
});
