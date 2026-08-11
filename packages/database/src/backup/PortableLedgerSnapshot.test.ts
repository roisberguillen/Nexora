import { Account, LocalDate, Money, RecurringRule, Transaction } from "@nexora/domain";
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
