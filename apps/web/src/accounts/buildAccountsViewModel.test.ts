import { Account, LocalDate, Money, Transaction } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { buildAccountsViewModel } from "./buildAccountsViewModel";

describe("buildAccountsViewModel", () => {
  it("calcola saldi, stato e modificabilità del saldo iniziale", () => {
    const main = Account.create({
      id: "account-main",
      name: "Conto principale",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(10_000n, "EUR"),
    });
    const space = Account.create({
      id: "space-demo",
      name: "Spazio demo",
      type: "virtual_subaccount",
      currency: "EUR",
      parentAccountId: main.id,
      isArchived: true,
    });
    const income = Transaction.create({
      id: "income-demo",
      kind: "income",
      status: "booked",
      accountId: main.id,
      amount: Money.fromMinor(2_500n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-28"),
    });

    const model = buildAccountsViewModel({
      accounts: [space, main],
      transactions: [income],
    });

    expect(model.activeCount).toBe(1);
    expect(model.archivedCount).toBe(1);
    expect(model.totalEur.amountMinor).toBe(12_500n);
    expect(model.accounts[0]).toMatchObject({
      balance: { amountMinor: 12_500n },
      canEditOpeningBalance: false,
      id: main.id,
    });
    expect(model.accounts[1]).toMatchObject({
      canEditOpeningBalance: true,
      parentLabel: main.name,
    });
    expect(model.parentOptions).toEqual([{ currency: "EUR", id: main.id, name: main.name }]);
  });
});
