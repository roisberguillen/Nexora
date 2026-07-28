import { describe, expect, it } from "vitest";

import { Account } from "../entities/Account";
import { Transaction } from "../entities/Transaction";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { calculateAccountBalance, calculateTotalBalance, summarizeCashFlow } from "./ledgerReports";

const bookedDate = LocalDate.parse("2026-07-27");
const accountA = Account.create({
  id: "account-a",
  name: "Conto A",
  type: "checking",
  currency: "EUR",
  openingBalance: Money.fromMinor(100_000n, "EUR"),
});
const accountB = Account.create({
  id: "account-b",
  name: "Conto B",
  type: "savings",
  currency: "EUR",
  openingBalance: Money.fromMinor(20_000n, "EUR"),
});

function transaction(
  id: string,
  kind: "income" | "expense" | "transfer" | "adjustment",
  accountId: string,
  amountMinor: bigint,
) {
  return Transaction.create({
    id,
    kind,
    status: "booked",
    accountId,
    amount: Money.fromMinor(amountMinor, "EUR"),
    bookedDate,
  });
}

describe("ledger reports", () => {
  it("esclude trasferimenti e rettifiche dai report income/expense", () => {
    const transactions = [
      transaction("income", "income", accountA.id, 50_000n),
      transaction("expense", "expense", accountA.id, -5_000n),
      transaction("debit", "transfer", accountA.id, -10_000n),
      transaction("credit", "transfer", accountB.id, 10_000n),
      transaction("adjustment", "adjustment", accountA.id, 500n),
    ];

    const summary = summarizeCashFlow(transactions, "EUR");

    expect(summary.income.amountMinor).toBe(50_000n);
    expect(summary.expense.amountMinor).toBe(5_000n);
    expect(summary.net.amountMinor).toBe(45_000n);
  });

  it("mantiene invariato il saldo totale per un trasferimento interno", () => {
    const transactions = [
      transaction("debit", "transfer", accountA.id, -10_000n),
      transaction("credit", "transfer", accountB.id, 10_000n),
    ];

    expect(calculateAccountBalance(accountA, transactions).amountMinor).toBe(90_000n);
    expect(calculateAccountBalance(accountB, transactions).amountMinor).toBe(30_000n);
    expect(calculateTotalBalance([accountA, accountB], transactions, "EUR").amountMinor).toBe(
      120_000n,
    );
  });

  it("include la fee nel saldo e nella spesa, separata dal trasferimento", () => {
    const transactions = [
      transaction("debit", "transfer", accountA.id, -10_000n),
      transaction("credit", "transfer", accountB.id, 10_000n),
      transaction("fee", "expense", accountA.id, -250n),
    ];

    expect(calculateTotalBalance([accountA, accountB], transactions, "EUR").amountMinor).toBe(
      119_750n,
    );
    expect(summarizeCashFlow(transactions, "EUR").expense.amountMinor).toBe(250n);
  });
});
