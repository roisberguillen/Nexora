import {
  Account,
  AllocationPlan,
  Budget,
  Category,
  LocalDate,
  Money,
  RecurringRule,
  Transaction,
} from "@nexora/domain";
import { describe, expect, it } from "vitest";
import {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  validatePortableLedgerSnapshot,
} from "./PortableLedgerSnapshot";
import { InMemoryLedgerRepository } from "../in-memory/InMemoryLedgerRepository";

describe("portable ledger snapshot", () => {
  it("serializes monetary values without lossy floating-point conversion", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "account-1",
        name: "Conto",
        type: "checking",
        currency: "EUR",
        openingBalance: Money.fromMinor(9_007_199_254_740_993n, "EUR"),
      }),
    );
    const snapshot = decodePortableLedgerSnapshot(
      encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
    );
    const account = snapshot.entities.accounts?.[0] as {
      readonly openingBalance: { readonly amountMinor: string };
    };
    expect(account.openingBalance.amountMinor).toBe("9007199254740993");
    expect(validatePortableLedgerSnapshot(snapshot).accounts[0]?.openingBalance.amountMinor).toBe(
      9_007_199_254_740_993n,
    );
  });

  it("rejects incomplete and malformed portable payloads before a restore can start", async () => {
    expect(() => decodePortableLedgerSnapshot(new TextEncoder().encode("{not-json"))).toThrow();
    const snapshot = await capturePortableLedgerSnapshot(new InMemoryLedgerRepository());
    const incomplete = {
      ...snapshot,
      relations: { splits: [], transactionTags: [] },
    };
    expect(() => validatePortableLedgerSnapshot(incomplete)).toThrow("importRows");
  });

  it("round-trips optional expense behavior while accepting a legacy snapshot without it", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "expense-account", name: "Conto", type: "checking", currency: "EUR" }),
    );
    await repository.saveTransaction(
      Transaction.create({
        id: "classified-expense",
        kind: "expense",
        status: "booked",
        accountId: "expense-account",
        amount: Money.fromMinor(-1_000n, "EUR"),
        bookedDate: LocalDate.parse("2026-08-08"),
        expenseVariability: "variable",
        expenseExceptionality: "extraordinary",
      }),
    );
    const snapshot = decodePortableLedgerSnapshot(
      encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
    );
    expect(validatePortableLedgerSnapshot(snapshot).transactions[0]).toMatchObject({
      expenseVariability: "variable",
      expenseExceptionality: "extraordinary",
    });
    const legacy = structuredClone(snapshot);
    const legacyTransaction = legacy.entities.transactions?.[0] as Record<string, unknown>;
    delete legacyTransaction.expenseVariability;
    delete legacyTransaction.expenseExceptionality;
    expect(
      validatePortableLedgerSnapshot(legacy).transactions[0]?.expenseVariability,
    ).toBeUndefined();
  });

  it("preserves allocation plans in a portable snapshot", async () => {
    const repository = new InMemoryLedgerRepository();
    const source = Account.create({
      id: "allocation-source",
      name: "Origine",
      type: "checking",
      currency: "EUR",
    });
    const target = Account.create({
      id: "allocation-target",
      name: "Destinazione",
      type: "savings",
      currency: "EUR",
    });
    await repository.saveAccount(source);
    await repository.saveAccount(target);
    const plan = AllocationPlan.create({
      id: "allocation-plan",
      name: "Risparmio",
      trigger: "salary",
      sourceAccountId: source.id,
      targetAccountId: target.id,
      amount: Money.fromMinor(10_000n, "EUR"),
      enabled: false,
    });
    await repository.saveAllocationPlan(plan);

    const snapshot = validatePortableLedgerSnapshot(
      decodePortableLedgerSnapshot(
        encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
      ),
    );

    expect(snapshot.allocationPlans).toEqual([plan]);
  });

  it("rejects an allocation plan that refers to an archived account before restore", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "allocation-source",
        name: "Origine",
        type: "checking",
        currency: "EUR",
      }),
    );
    await repository.saveAccount(
      Account.create({
        id: "allocation-target",
        name: "Destinazione",
        type: "savings",
        currency: "EUR",
      }),
    );
    await repository.saveAllocationPlan(
      AllocationPlan.create({
        id: "allocation-plan",
        name: "Risparmio",
        trigger: "salary",
        sourceAccountId: "allocation-source",
        targetAccountId: "allocation-target",
        amount: Money.fromMinor(10_000n, "EUR"),
      }),
    );
    const snapshot = decodePortableLedgerSnapshot(
      encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
    );
    const archivedAccount = snapshot.entities.accounts?.find(
      (value) => (value as { id: string }).id === "allocation-source",
    ) as { isArchived: boolean };
    archivedAccount.isArchived = true;

    expect(() => validatePortableLedgerSnapshot(snapshot)).toThrow(/allocation plan account/i);
  });

  it("keeps a disabled allocation plan when its account was archived", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "allocation-source",
        name: "Origine",
        type: "checking",
        currency: "EUR",
      }),
    );
    await repository.saveAccount(
      Account.create({
        id: "allocation-target",
        name: "Destinazione",
        type: "savings",
        currency: "EUR",
      }),
    );
    await repository.saveAllocationPlan(
      AllocationPlan.create({
        id: "allocation-plan",
        name: "Risparmio",
        trigger: "salary",
        sourceAccountId: "allocation-source",
        targetAccountId: "allocation-target",
        amount: Money.fromMinor(10_000n, "EUR"),
        enabled: false,
      }),
    );
    const snapshot = decodePortableLedgerSnapshot(
      encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
    );
    const archivedAccount = snapshot.entities.accounts?.find(
      (value) => (value as { id: string }).id === "allocation-source",
    ) as { isArchived: boolean };
    archivedAccount.isArchived = true;

    expect(validatePortableLedgerSnapshot(snapshot).allocationPlans[0]).toMatchObject({
      enabled: false,
      sourceAccountId: "allocation-source",
    });
  });

  it("preserves a hierarchical budget scope and alerts in a portable snapshot", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveCategory(
      Category.create({ id: "living", name: "Casa", kindScope: "expense" }),
    );
    await repository.saveBudget(
      Budget.create({
        id: "living-august",
        period: "2026-08",
        categoryId: "living",
        amount: Money.fromMinor(120_000n, "EUR"),
        firstAlertPercentage: 55,
        secondAlertPercentage: 95,
      }),
    );

    const snapshot = decodePortableLedgerSnapshot(
      encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
    );
    expect(validatePortableLedgerSnapshot(snapshot).budgets).toMatchObject([
      {
        id: "living-august",
        period: "2026-08",
        categoryId: "living",
        firstAlertPercentage: 55,
        secondAlertPercentage: 95,
      },
    ]);

    const legacy = structuredClone(snapshot);
    const legacyBudget = legacy.entities.budgets?.[0] as Record<string, unknown>;
    delete legacyBudget.firstAlertPercentage;
    delete legacyBudget.secondAlertPercentage;
    legacyBudget.alertAt80 = true;
    legacyBudget.alertAt100 = true;
    expect(validatePortableLedgerSnapshot(legacy).budgets[0]).toMatchObject({
      firstAlertPercentage: 80,
      secondAlertPercentage: 100,
    });
  });

  it("round-trips advanced recurring schedules while accepting a legacy monthly rule", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "recurring-account", name: "Conto", type: "checking", currency: "EUR" }),
    );
    await repository.saveRecurringRule(
      RecurringRule.create({
        id: "annual-rule",
        name: "Assicurazione",
        kind: "expense",
        accountId: "recurring-account",
        amount: Money.fromMinor(-12_000n, "EUR"),
        frequencyUnit: "year",
        interval: 2,
        nominalDay: 29,
        nominalMonth: 2,
        nextNominalDate: LocalDate.parse("2028-02-29"),
        weekendPolicy: "next_business_day",
        retiredAt: "2026-08-09T10:00:00.000Z",
        expenseVariability: "fixed",
        expenseExceptionality: "ordinary",
      }),
    );

    const snapshot = decodePortableLedgerSnapshot(
      encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
    );
    const [rule] = validatePortableLedgerSnapshot(snapshot).recurringRules;
    expect(rule).toMatchObject({
      frequencyUnit: "year",
      interval: 2,
      nominalMonth: 2,
      nextNominalDate: LocalDate.parse("2028-02-29"),
      retiredAt: "2026-08-09T10:00:00.000Z",
    });

    const legacy = structuredClone(snapshot);
    const legacyRule = legacy.entities.recurringRules?.[0] as Record<string, unknown>;
    delete legacyRule.frequencyUnit;
    delete legacyRule.nominalMonth;
    delete legacyRule.nextNominalDate;
    delete legacyRule.retiredAt;
    delete legacyRule.expenseVariability;
    delete legacyRule.expenseExceptionality;
    expect(validatePortableLedgerSnapshot(legacy).recurringRules[0]?.frequencyUnit).toBe("month");
  });
});
