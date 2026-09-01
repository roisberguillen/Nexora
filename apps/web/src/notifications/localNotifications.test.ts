import { describe, expect, it } from "vitest";
import {
  Account,
  Budget,
  Loan,
  LocalDate,
  Money,
  RecurringRule,
  Transaction,
} from "@nexora/domain";

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
  it("emits only the most severe configured budget threshold", () => {
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
    ).toEqual(["budget-threshold:food:2026-07:80"]);
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

  it("deriva un avviso per una rata imminente senza creare movimenti", () => {
    const loan = Loan.create({
      id: "loan",
      accountId: "loan-account",
      lender: "Banca",
      installment: Money.fromMinor(10_000n, "EUR"),
      remainingPrincipal: Money.fromMinor(100_000n, "EUR"),
      nextDueDate: LocalDate.parse("2026-08-04"),
    });
    const notifications = deriveLocalNotifications({
      backupHistory: [],
      budgets: [],
      loans: [loan],
      recurringRules: [],
      today: new Date("2026-08-01T12:00:00.000Z"),
      transactions: [],
    });
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "loan:loan:2026-08-04", href: "./#loans", kind: "loan" }),
      ]),
    );
  });

  it("non segnala una rata quando il prestito è già estinto", () => {
    const loan = Loan.create({
      id: "paid-loan",
      accountId: "loan-account",
      lender: "Banca",
      installment: Money.fromMinor(10_000n, "EUR"),
      remainingPrincipal: Money.fromMinor(0n, "EUR"),
      nextDueDate: LocalDate.parse("2026-08-04"),
    });

    expect(
      deriveLocalNotifications({
        backupHistory: [],
        budgets: [],
        loans: [loan],
        recurringRules: [],
        today: new Date("2026-08-01T12:00:00.000Z"),
        transactions: [],
      }).some((notification) => notification.kind === "loan"),
    ).toBe(false);
  });

  it("ignora le ricorrenze disabilitate e deduplica le derivazioni ripetute", () => {
    const enabled = RecurringRule.create({
      accountId: "main",
      amount: Money.fromMinor(-25_000n, "EUR"),
      id: "enabled",
      kind: "expense",
      name: "Affitto",
      nextExpectedDate: LocalDate.parse("2026-08-04"),
      nominalDay: 4,
    });
    const disabled = RecurringRule.create({
      accountId: "main",
      amount: Money.fromMinor(-10_000n, "EUR"),
      enabled: false,
      id: "disabled",
      kind: "expense",
      name: "Regola disabilitata",
      nextExpectedDate: LocalDate.parse("2026-08-04"),
      nominalDay: 4,
    });
    const input = {
      backupHistory: [
        {
          id: "backup",
          occurredAt: "2026-08-01T12:00:00.000Z",
          operation: "local_backup" as const,
          outcome: "succeeded" as const,
          storageKind: "indexeddb" as const,
        },
        {
          id: "recovery",
          occurredAt: "2026-08-01T12:00:00.000Z",
          operation: "restore_test" as const,
          outcome: "succeeded" as const,
          storageKind: "indexeddb" as const,
        },
      ],
      budgets: [],
      loans: [],
      recurringRules: [enabled, disabled],
      today: new Date("2026-08-03T23:30:00.000Z"),
      transactions: [],
    };

    const first = deriveLocalNotifications(input);
    const second = deriveLocalNotifications(input);
    expect(first).toEqual(second);
    expect(first.map((notification) => notification.id)).toEqual(["recurring:enabled:2026-08-04"]);
  });

  it("calcola oggi secondo Europe/Rome anche vicino alla mezzanotte UTC", () => {
    const rule = RecurringRule.create({
      accountId: "main",
      amount: Money.fromMinor(-25_000n, "EUR"),
      id: "rent",
      kind: "expense",
      name: "Affitto",
      nextExpectedDate: LocalDate.parse("2026-08-04"),
      nominalDay: 4,
    });

    expect(
      deriveLocalNotifications({
        backupHistory: [
          {
            id: "backup",
            occurredAt: "2026-08-01T12:00:00.000Z",
            operation: "local_backup",
            outcome: "succeeded",
            storageKind: "indexeddb",
          },
          {
            id: "recovery",
            occurredAt: "2026-08-01T12:00:00.000Z",
            operation: "restore_test",
            outcome: "succeeded",
            storageKind: "indexeddb",
          },
        ],
        budgets: [],
        loans: [],
        recurringRules: [rule],
        today: new Date("2026-08-03T23:30:00.000Z"),
        transactions: [],
      }),
    ).toEqual([
      expect.objectContaining({ id: "recurring:rent:2026-08-04", description: "Prevista oggi." }),
    ]);
  });
});
