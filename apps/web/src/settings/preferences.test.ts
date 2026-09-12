import { describe, expect, it } from "vitest";

import { applyAppPreferences, readAppPreferences, writeAppPreferences } from "./preferences";

describe("app preferences", () => {
  it("persists only validated local preference values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    writeAppPreferences(
      {
        reduceMotion: true,
        theme: "dark",
        textScale: "large",
        financialMonthStartDay: 15,
        trashRetentionDays: 90,
      },
      storage,
    );
    expect(readAppPreferences(storage)).toEqual({
      reduceMotion: true,
      theme: "dark",
      textScale: "large",
      financialMonthStartDay: 15,
      trashRetentionDays: 90,
    });
  });

  it("falls back to safe defaults for malformed local preferences", () => {
    const storage = { getItem: () => "{not-json" };

    expect(readAppPreferences(storage)).toEqual({
      reduceMotion: false,
      theme: "light",
      textScale: "medium",
      financialMonthStartDay: 1,
      trashRetentionDays: 30,
    });
  });

  it("applies the selected theme to the document root", () => {
    applyAppPreferences({
      reduceMotion: false,
      theme: "dark",
      textScale: "medium",
      financialMonthStartDay: 1,
      trashRetentionDays: 30,
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
