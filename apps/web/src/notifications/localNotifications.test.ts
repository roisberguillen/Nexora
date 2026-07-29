import { describe, expect, it } from "vitest";

import { readLocalNotificationStates, writeLocalNotificationStates } from "./localNotifications";

describe("local notification state", () => {
  it("persiste soltanto stato letto e dismiss, separato dal ledger", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    writeLocalNotificationStates(
      { "budget-warning:food:2026-07": { dismissed: true, readAt: "2026-07-29T08:00:00.000Z" } },
      storage,
    );

    expect(readLocalNotificationStates(storage)).toEqual({
      "budget-warning:food:2026-07": { dismissed: true, readAt: "2026-07-29T08:00:00.000Z" },
    });
  });
});
