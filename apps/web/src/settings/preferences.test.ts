import { describe, expect, it } from "vitest";

import { readAppPreferences, writeAppPreferences } from "./preferences";

describe("app preferences", () => {
  it("persists only validated local preference values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    writeAppPreferences(
      { reduceMotion: true, theme: "dark", textScale: "large", trashRetentionDays: 90 },
      storage,
    );
    expect(readAppPreferences(storage)).toEqual({
      reduceMotion: true,
      theme: "dark",
      textScale: "large",
      trashRetentionDays: 90,
    });
  });

  it("falls back to safe defaults for malformed local preferences", () => {
    const storage = { getItem: () => "{not-json" };

    expect(readAppPreferences(storage)).toEqual({
      reduceMotion: false,
      theme: "light",
      textScale: "medium",
      trashRetentionDays: 30,
    });
  });
});
