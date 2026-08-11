import { describe, expect, it } from "vitest";
import { Account, Budget, LocalDate, Money, RecurringRule, Transaction } from "@nexora/domain";

import {
  deriveLocalNotifications,
  readLocalNotificationPreferences,
  readLocalNotificationStates,
  writeLocalNotificationPreferences,
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
  it("emits each configured budget threshold once with deterministic identifiers", () => {
    const budget = Budget.create({
      id: "food",
      period: "2026-07",
      categoryId: "food",
      amount: Money.fromMinor(10_000n, "EUR"),
      firstAlertPercentage: 50,
      secondAlertPercentage: 80,
    });
    const expense = (amountMinor: bigint) =>
      Transaction.create({
        id: `expense-${amountMinor}`,
        kind: "expense",
        status: "booked",
        accountId: "main",
        amount: Money.fromMinor(amountMinor, "EUR"),
        bookedDate: LocalDate.parse("2026-07-15"),
        categoryId: "food",
      });
    const input = {
      backupHistory: [
        {
          id: "backup",
          occurredAt: "2026-07-28T12:00:00.000Z",
          operation: "local_backup" as const,
          outcome: "succeeded" as const,
          storageKind: "indexeddb" as const,
        },
        {
          id: "recovery",
          occurredAt: "2026-07-28T12:00:00.000Z",
          operation: "restore_test" as const,
          outcome: "succeeded" as const,
          storageKind: "indexeddb" as const,
        },
      ],
      budgets: [budget],
      loans: [],
      recurringRules: [],
      today: new Date("2026-07-29T12:00:00.000Z"),
    };

    expect(deriveLocalNotifications({ ...input, transactions: [expense(-4_900n)] })).toEqual([]);
    expect(
      deriveLocalNotifications({ ...input, transactions: [expense(-5_000n)] }).map(
        (item) => item.id,
      ),
    ).toEqual(["budget-threshold:food:2026-07:50"]);
    expect(
      deriveLocalNotifications({ ...input, transactions: [expense(-9_000n)] }).map(
        (item) => item.id,
      ),
    ).toEqual(["budget-threshold:food:2026-07:50", "budget-threshold:food:2026-07:80"]);
  });

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

  it("segnala saldo basso ed entrata prevista non registrata", () => {
    const account = Account.create({
      currency: "EUR",
      id: "main",
      name: "Conto principale",
      openingBalance: Money.fromMinor(0n, "EUR"),
      type: "checking",
    });
    const salary = RecurringRule.create({
      accountId: account.id,
      amount: Money.fromMinor(250_000n, "EUR"),
      id: "salary",
      kind: "income",
      name: "Stipendio",
      nextExpectedDate: LocalDate.parse("2026-07-25"),
      nominalDay: 25,
    });

    const notifications = deriveLocalNotifications({
      accounts: [account],
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
      lowBalanceThresholdMinor: 0n,
      recurringRules: [salary],
      today: new Date("2026-07-29T12:00:00.000Z"),
      transactions: [],
    });

    expect(notifications.map((notification) => notification.id)).toEqual([
      "low_balance:main:2026-07:0",
      "expected_income_missing:salary:2026-07-25",
    ]);
  });

  it("persiste la soglia in minor unit senza usare float", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    writeLocalNotificationPreferences({ lowBalanceThresholdMinor: 12_345n }, storage);

    expect(readLocalNotificationPreferences(storage).lowBalanceThresholdMinor).toBe(12_345n);
  });
});
