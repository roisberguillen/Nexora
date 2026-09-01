import { describe, expect, it } from "vitest";

import { readLocalProfile, saveLocalProfile } from "./profileStorage";

function createStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("nexora.profile.v1", initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("profile storage", () => {
  it("normalizes and persists only the display name", () => {
    const storage = createStorage();

    expect(saveLocalProfile("  Ada   Lovelace  ", storage)).toEqual({
      displayName: "Ada Lovelace",
    });
    expect(readLocalProfile(storage)).toEqual({ displayName: "Ada Lovelace" });
  });

  it("falls back safely for malformed or empty persisted values", () => {
    expect(readLocalProfile(createStorage("not-json"))).toEqual({});
    expect(readLocalProfile(createStorage(JSON.stringify({ displayName: "   " })))).toEqual({});
  });

  it("rejects whitespace-only and overlong names", () => {
    const storage = createStorage();

    expect(() => saveLocalProfile("   ", storage)).toThrow("profile_name_required");
    expect(() => saveLocalProfile("a".repeat(121), storage)).toThrow("profile_name_too_long");
  });
});
