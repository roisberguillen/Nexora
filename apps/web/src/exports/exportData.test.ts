import { Account, Category, LocalDate, Money, Transaction } from "@nexora/domain";
import { describe, expect, it } from "vitest";
import { buildLedgerJson, buildTransactionsCsv, filterExportTransactions } from "./exportData";

describe("ledger exports", () => {
  const account = Account.create({
    id: "account-1",
    name: "Conto",
    type: "checking",
    currency: "EUR",
  });
  const category = Category.create({ id: "category-1", name: "Spese", kindScope: "expense" });
  const transaction = Transaction.create({
    id: "transaction-1",
    kind: "expense",
    status: "booked",
    accountId: account.id,
    categoryId: category.id,
    amount: Money.fromMinor(-12345n, "EUR"),
    bookedDate: LocalDate.parse("2026-07-28"),
    payee: "=unsafe",
    expenseVariability: "fixed",
    expenseExceptionality: "ordinary",
  });
  const data = { accounts: [account], categories: [category], transactions: [transaction] };

  it("preserva minor units e neutralizza formule CSV", () => {
    expect(buildTransactionsCsv(data)).toContain('"-12345"');
    expect(buildTransactionsCsv(data)).toContain('"\'=unsafe"');
    expect(buildTransactionsCsv(data)).toContain('"fixed"');
    expect(buildTransactionsCsv(data)).toContain('"ordinary"');
  });
  it("serializza il JSON senza bigint", () => {
    expect(JSON.parse(buildLedgerJson(data))).toMatchObject({
      format: "nexora-ledger-export",
      transactions: [{ amount: { amountMinor: "-12345", currency: "EUR" } }],
    });
  });
  it("filtra per intervallo e conto senza modificare i dati", () => {
    expect(filterExportTransactions(data.transactions, { accountId: "other" })).toEqual([]);
    expect(
      filterExportTransactions(data.transactions, { from: "2026-07-28", to: "2026-07-28" }),
    ).toEqual([transaction]);
  });
});
