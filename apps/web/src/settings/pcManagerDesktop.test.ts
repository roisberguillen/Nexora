import { describe, expect, it, vi } from "vitest";

import {
  getDesktopLocalHubStatus,
  startDesktopLocalHub,
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
});
