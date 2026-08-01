import { describe, expect, it, vi } from "vitest";

import {
  readRecoverySelection,
  selectableRecoveryArchives,
  writeRecoverySelection,
} from "./StartupRecovery";

const archives = [
  { kind: "opfs", available: true, state: "present", lastCheckedAt: "2026-07-30T00:00:00.000Z" },
  {
    kind: "indexeddb",
    available: true,
    state: "present",
    lastCheckedAt: "2026-07-30T00:00:00.000Z",
  },
] as const;

describe("startup recovery selection", () => {
  it("permette soltanto archivi presenti e disponibili", () => {
    expect(
      selectableRecoveryArchives([
        ...archives,
        { kind: "opfs", available: false, state: "unavailable", lastCheckedAt: "now" },
      ]),
    ).toEqual(archives);
  });

  it("consuma una scelta esplicita solo se corrisponde a un archivio rilevato", () => {
    const storage = { getItem: vi.fn(() => "indexeddb"), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    expect(readRecoverySelection(archives)).toBe("indexeddb");
    expect(storage.removeItem).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("non consuma né applica una selezione che non corrisponde a un archivio presente", () => {
    const storage = { getItem: vi.fn(() => "opfs"), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    expect(readRecoverySelection([archives[1]])).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith("nexora.startup-recovery-storage.v1");
    vi.unstubAllGlobals();
  });

  it("salva solo la scelta esplicita richiesta dal recupero guidato", () => {
    const storage = { setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    writeRecoverySelection("indexeddb");
    expect(storage.setItem).toHaveBeenCalledWith("nexora.startup-recovery-storage.v1", "indexeddb");
    vi.unstubAllGlobals();
  });
});
