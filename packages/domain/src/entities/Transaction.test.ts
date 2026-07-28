import { describe, expect, it } from "vitest";

import { DomainError } from "../errors/DomainError";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Transaction } from "./Transaction";

const bookedDate = LocalDate.parse("2026-07-27");

describe("Transaction", () => {
  it("applica la convenzione signed a entrate e spese", () => {
    const income = Transaction.create({
      id: "income-demo",
      kind: "income",
      status: "booked",
      accountId: "account-main",
      amount: Money.fromMinor(100_000n, "EUR"),
      bookedDate,
    });
    const expense = Transaction.create({
      id: "expense-demo",
      kind: "expense",
      status: "booked",
      accountId: "account-main",
      amount: Money.fromMinor(-2_500n, "EUR"),
      bookedDate,
    });

    expect(income.amount.isPositive()).toBe(true);
    expect(expense.amount.isNegative()).toBe(true);
    expect(income.affectsIncomeExpense()).toBe(true);
    expect(expense.affectsIncomeExpense()).toBe(true);
  });

  it("rifiuta importi nulli o con segno incoerente", () => {
    expect(() =>
      Transaction.create({
        id: "income-invalid",
        kind: "income",
        status: "booked",
        accountId: "account-main",
        amount: Money.fromMinor(-1n, "EUR"),
        bookedDate,
      }),
    ).toThrowError(DomainError);

    expect(() =>
      Transaction.create({
        id: "zero-invalid",
        kind: "adjustment",
        status: "booked",
        accountId: "account-main",
        amount: Money.zero("EUR"),
        bookedDate,
      }),
    ).toThrowError(DomainError);
  });

  it("esclude le transazioni annullate da saldo e report", () => {
    const cancelled = Transaction.create({
      id: "cancelled-demo",
      kind: "income",
      status: "cancelled",
      accountId: "account-main",
      amount: Money.fromMinor(50_000n, "EUR"),
      bookedDate,
    });

    expect(cancelled.affectsBalance()).toBe(false);
    expect(cancelled.affectsIncomeExpense()).toBe(false);
  });

  it("annulla un movimento non riconciliato senza alterarne i dati contabili", () => {
    const income = Transaction.create({
      id: "income-demo",
      kind: "income",
      status: "booked",
      accountId: "account-main",
      amount: Money.fromMinor(100_000n, "EUR"),
      bookedDate,
    });

    const cancelled = income.cancel();
    expect(cancelled).toMatchObject({
      id: income.id,
      kind: income.kind,
      status: "cancelled",
    });
    expect(cancelled.amount.equals(income.amount)).toBe(true);

    const reconciled = Transaction.create({
      ...{
        id: "income-reconciled",
        kind: "income" as const,
        status: "reconciled" as const,
        accountId: "account-main",
        amount: Money.fromMinor(100n, "EUR"),
        bookedDate,
      },
    });
    expect(() => reconciled.cancel()).toThrowError(DomainError);
  });

  it("vincola batch e fingerprint alle sole transazioni importate", () => {
    const imported = Transaction.create({
      id: "import-1",
      kind: "income",
      status: "booked",
      accountId: "account-main",
      amount: Money.fromMinor(100n, "EUR"),
      bookedDate,
      source: "import",
      importBatchId: "batch-1",
      sourceFingerprint: "a".repeat(64),
    });
    expect(imported.cancel().sourceFingerprint).toBe("a".repeat(64));
    expect(() =>
      Transaction.create({
        id: "import-2",
        kind: "income",
        status: "booked",
        accountId: "account-main",
        amount: Money.fromMinor(100n, "EUR"),
        bookedDate,
        source: "import",
      }),
    ).toThrow("batch");
  });
});
