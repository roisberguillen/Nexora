import { describe, expect, it, vi } from "vitest";

import { withStartupLock } from "./StartupLock";

describe("withStartupLock", () => {
  it("usa un lock esclusivo per serializzare l'apertura", async () => {
    const action = vi.fn(async () => "opened");
    const request = vi.fn(async (_name, _options, callback) => callback());

    await expect(withStartupLock(action, { request })).resolves.toBe("opened");
    expect(request).toHaveBeenCalledWith("nexora-ledger-startup", { mode: "exclusive" }, action);
  });

  it("prosegue senza lock nei browser che non espongono Web Locks", async () => {
    const action = vi.fn(async () => "opened");
    await expect(withStartupLock(action, undefined)).resolves.toBe("opened");
    expect(action).toHaveBeenCalledOnce();
  });
});
