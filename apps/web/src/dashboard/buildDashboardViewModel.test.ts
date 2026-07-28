import { createDemoLedgerSeed } from "@nexora/database";
import { Account, InvestmentPosition, Loan, LocalDate, Money, Transaction } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { buildDashboardViewModel, type DashboardLedgerData } from "./buildDashboardViewModel";

function demoLedgerData(): DashboardLedgerData {
  const seed = createDemoLedgerSeed();
  return {
    accounts: seed.accounts,
    categories: seed.categories,
    transactions: [
      ...seed.transactions,
      ...seed.transfers.flatMap((bundle) => [bundle.debitTransaction, bundle.creditTransaction]),
    ],
    transfers: seed.transfers.map((bundle) => bundle.transfer),
  };
}

describe("buildDashboardViewModel", () => {
  it("calcola metriche esatte escludendo trasferimenti e operazioni annullate", () => {
    const dashboard = buildDashboardViewModel(demoLedgerData());

    expect(dashboard.netWorth.amountMinor).toBe(513_360n);
    expect(dashboard.income.amountMinor).toBe(240_000n);
    expect(dashboard.expense.amountMinor).toBe(89_640n);
    expect(dashboard.netCashFlow.amountMinor).toBe(150_360n);
  });

  it("collassa le due gambe del trasferimento in una sola attività neutrale", () => {
    const dashboard = buildDashboardViewModel(demoLedgerData());
    const transferActivity = dashboard.activity.find(
      (activity) => activity.kindLabel === "Trasferimento",
    );

    expect(transferActivity).toMatchObject({
      accountLabel: "Conto quotidiano demo → Riserva demo",
      amount: {
        amountMinor: 12_500n,
        currency: "EUR",
      },
      categoryLabel: "Trasferimento interno",
      tone: "neutral",
    });
    expect(
      dashboard.activity.filter((activity) => activity.kindLabel === "Trasferimento"),
    ).toHaveLength(1);
  });

  it("mantiene visibile l'annullamento ma non lo include nei saldi", () => {
    const dashboard = buildDashboardViewModel(demoLedgerData());

    expect(dashboard.activity).toContainEqual(
      expect.objectContaining({
        isCancelled: true,
        kindLabel: "Annullato",
        title: "Servizio campione",
      }),
    );
    expect(
      dashboard.accounts.find((account) => account.id === "demo-account-primary"),
    ).toMatchObject({
      balance: {
        amountMinor: 374_710n,
        currency: "EUR",
      },
    });
  });

  it("non converte né somma conti in una valuta diversa", () => {
    const usdAccount = Account.create({
      id: "usd-account",
      name: "Conto USD demo",
      type: "checking",
      currency: "USD",
      openingBalance: Money.fromMinor(900_719_925_474_099_312_345n, "USD"),
    });
    const usdIncome = Transaction.create({
      id: "usd-income",
      kind: "income",
      status: "booked",
      accountId: usdAccount.id,
      amount: Money.fromMinor(500n, "USD"),
      bookedDate: LocalDate.parse("2026-07-20"),
    });
    const data = demoLedgerData();

    const dashboard = buildDashboardViewModel({
      ...data,
      accounts: [...data.accounts, usdAccount],
      transactions: [...data.transactions, usdIncome],
    });

    expect(dashboard.netWorth.amountMinor).toBe(513_360n);
    expect(dashboard.excludedCurrencyAccountCount).toBe(1);
    expect(
      dashboard.accounts.find((account) => account.id === usdAccount.id)?.balance.amountMinor,
    ).toBe(900_719_925_474_099_312_845n);
  });

  it("espone separatamente debiti e rendimento degli investimenti", () => {
    const account = Account.create({
      id: "investment",
      name: "Directa",
      type: "investment",
      currency: "EUR",
    });
    const loan = Loan.create({
      id: "loan",
      accountId: "loan-account",
      lender: "Agos",
      installment: Money.fromMinor(7_200n, "EUR"),
      remainingPrincipal: Money.fromMinor(200_000n, "EUR"),
    });
    const position = InvestmentPosition.create({
      id: "position",
      accountId: account.id,
      name: "ETF",
      costBasis: Money.fromMinor(100_000n, "EUR"),
      currentValue: Money.fromMinor(112_500n, "EUR"),
      valuationDate: LocalDate.parse("2026-08-01"),
    });
    const data = demoLedgerData();
    const dashboard = buildDashboardViewModel({
      ...data,
      accounts: [...data.accounts, account],
      loans: [loan],
      investmentPositions: [position],
    });
    expect(dashboard.loanBalance.amountMinor).toBe(200_000n);
    expect(dashboard.investmentValue.amountMinor).toBe(112_500n);
    expect(dashboard.investmentGainLoss.amountMinor).toBe(12_500n);
  });
});
