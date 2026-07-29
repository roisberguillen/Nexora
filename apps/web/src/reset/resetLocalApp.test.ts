import { describe, expect, it, vi } from "vitest";

import { resetLocalApp } from "./resetLocalApp";

describe("resetLocalApp", () => {
  it("rimuove solo chiavi e cache Nexora per IndexedDB", async () => {
    const removeItem = vi.fn();
    const close = vi.fn(async () => undefined);
    const deleteCache = vi.fn(async () => true);
    const deleteDatabase = vi.fn(() => {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => request.onsuccess?.call(request, new Event("success")));
      return request;
    });
    await resetLocalApp({ close, storageKind: "indexeddb" } as never, {
      localStorage: { removeItem },
      indexedDb: { deleteDatabase },
      caches: { keys: async () => ["nexora-pwa", "other"], delete: deleteCache },
    });
    expect(close).toHaveBeenCalledOnce();
    expect(deleteDatabase).toHaveBeenCalledWith("nexora-ledger");
    expect(deleteCache).toHaveBeenCalledWith("nexora-pwa");
    expect(removeItem).toHaveBeenCalledTimes(6);
  });
});
