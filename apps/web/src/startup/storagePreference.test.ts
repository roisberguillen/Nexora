import { describe, expect, it, vi } from "vitest";

import { PWA_LEDGER_STORAGE_KEY } from "../persistence/openPwaLedger";
import { readStoragePreferenceHint } from "./storagePreference";

describe("readStoragePreferenceHint", () => {
  it("legge soltanto un backend valido", () => {
    const storage = { getItem: vi.fn(() => "indexeddb"), removeItem: vi.fn() };
    expect(readStoragePreferenceHint(storage)).toBe("indexeddb");
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("rimuove una preferenza non valida senza bloccare la discovery", () => {
    const storage = { getItem: vi.fn(() => "unknown-backend"), removeItem: vi.fn() };
    expect(readStoragePreferenceHint(storage)).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(PWA_LEDGER_STORAGE_KEY);
  });

  it("non propaga errori del local storage", () => {
    expect(
      readStoragePreferenceHint({
        getItem: vi.fn(() => {
          throw new Error("denied");
        }),
        removeItem: vi.fn(),
      }),
    ).toBeUndefined();
  });
});
