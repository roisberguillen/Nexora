import { describe, expect, it } from "vitest";

import {
  deriveLocalNotifications,
  readLocalNotificationStates,
  writeLocalNotificationStates,
} from "./localNotifications";

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

describe("local notification derivation", () => {
  it("segnala backup e recovery drill scaduti con identificativi deterministici", () => {
    const notifications = deriveLocalNotifications({
      backupHistory: [],
      budgets: [],
      loans: [],
      recurringRules: [],
      today: new Date("2026-07-29T12:00:00.000Z"),
      transactions: [],
    });

    expect(notifications.map((notification) => notification.id)).toEqual([
      "backup_overdue:2026-07",
      "restore_test_overdue:2026-07",
    ]);
  });

  it("non segnala gli avvisi quando backup e recovery drill sono recenti", () => {
    const notifications = deriveLocalNotifications({
      backupHistory: [
        {
          id: "recovery",
          occurredAt: "2026-07-01T12:00:00.000Z",
          operation: "restore_test",
          outcome: "succeeded",
          storageKind: "indexeddb",
        },
        {
          id: "backup",
          occurredAt: "2026-07-25T12:00:00.000Z",
          operation: "local_backup",
          outcome: "succeeded",
          storageKind: "indexeddb",
        },
      ],
      budgets: [],
      loans: [],
      recurringRules: [],
      today: new Date("2026-07-29T12:00:00.000Z"),
      transactions: [],
    });

    expect(notifications).toEqual([]);
  });
});
