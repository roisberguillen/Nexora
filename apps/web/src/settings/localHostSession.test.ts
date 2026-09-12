import { describe, expect, it, vi } from "vitest";

import { LocalHostSessionController } from "./localHostSession";

describe("LocalHostSessionController", () => {
  it("keeps the session token volatile and clears it even when logout fails", async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/logout")) return new Response("", { status: 503 });
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });
    const controller = new LocalHostSessionController(
      "https://host.home",
      { deviceId: "device-1", deviceToken: "device-token" },
      request,
    );
    await controller.unlock("4937", "session-token");
    expect(controller.state().sessionToken).toBe("session-token");
    await expect(controller.logout()).rejects.toThrow("host_session_logout_failed_503");
    expect(controller.state().sessionToken).toBeUndefined();
  });
});
