import { describe, expect, it, vi } from "vitest";

import { retryTransient, selectStorage } from "./StorageSelection";

const archive = (kind: "opfs" | "indexeddb", state: "absent" | "present" | "blocked") => ({
  kind,
  available: state !== "blocked",
  state,
  lastCheckedAt: "2026-07-29T12:00:00.000Z",
});

describe("selectStorage", () => {
  it("preferisce l'unico archivio esistente invece della preferenza", () => {
    expect(
      selectStorage([archive("opfs", "present"), archive("indexeddb", "absent")], "indexeddb"),
    ).toEqual({
      kind: "open",
      storageKind: "opfs",
    });
  });

  it("attiva il recupero guidato con due archivi presenti", () => {
    expect(selectStorage([archive("opfs", "present"), archive("indexeddb", "present")])).toEqual({
      kind: "guided-recovery",
      reason: "multiple-data-archives",
    });
  });

  it("non apre un archivio vuoto quando un altro è bloccato", () => {
    expect(selectStorage([archive("opfs", "blocked"), archive("indexeddb", "absent")])).toEqual({
      kind: "guided-recovery",
      reason: "unsafe-state",
    });
  });
});

describe("retryTransient", () => {
  it("ritenta errori temporanei con backoff", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ready");
    const sleep = vi.fn(async () => undefined);
    await expect(retryTransient(action, () => true, { sleep })).resolves.toBe("ready");
    expect(action).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(150, undefined);
  });
});
