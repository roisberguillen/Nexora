import { createDemoLedgerSeed } from "@nexora/database";
import {
  Account,
  Budget,
  Category,
  type CreateAccountProps,
  InvestmentPosition,
  Loan,
  LocalDate,
  Money,
  Transaction,
} from "@nexora/domain";
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

function account(id = "cash", props: Partial<CreateAccountProps> = {}) {
  return Account.create({
    id,
    name: id,
    type: "checking",
    currency: "EUR",
    ...props,
  });
}

function transaction(
  id: string,
  kind: "income" | "expense",
  amountMinor: bigint,
  date = "2026-08-10",
  categoryId?: string,
) {
  return Transaction.create({
    id,
    kind,
    status: "booked",
    accountId: "cash",
    amount: Money.fromMinor(kind === "expense" ? -amountMinor : amountMinor, "EUR"),
    bookedDate: LocalDate.parse(date),
    ...(categoryId === undefined ? {} : { categoryId }),
  });
}

function minimalData(
  transactions: readonly Transaction[] = [],
  budgets: readonly Budget[] = [],
  accounts: readonly Account[] = [account()],
  categories: readonly Category[] = [],
): DashboardLedgerData {
  return { accounts, categories, transactions, transfers: [], budgets };
}

function budget(id: string, amountMinor = 100_000n, categoryId?: string) {
  return Budget.create({
    id,
    period: "2026-08",
    amount: Money.fromMinor(amountMinor, "EUR"),
    ...(categoryId === undefined ? {} : { categoryId }),
    firstAlertPercentage: 50,
    secondAlertPercentage: 80,
  });
}

describe("buildDashboardViewModel", () => {
  it("calcola metriche esatte escludendo trasferimenti e operazioni annullate", () => {
    const dashboard = buildDashboardViewModel(
      demoLedgerData(),
      "EUR",
      new Date("2026-07-27T12:00:00+02:00"),
    );

    expect(dashboard.netWorth.amountMinor).toBe(513_360n);
    expect(dashboard.income.amountMinor).toBe(240_000n);
    expect(dashboard.expense.amountMinor).toBe(89_640n);
    expect(dashboard.netCashFlow.amountMinor).toBe(150_360n);
  });

  it("filtra KPI, risparmio e trend sul mese corrente deterministico", () => {
    const data = demoLedgerData();
    const dashboard = buildDashboardViewModel(data, "EUR", new Date("2026-08-26T12:00:00+02:00"));
    expect(dashboard.period).toBe("2026-08");
    expect(dashboard.income.amountMinor).toBe(0n);
    expect(dashboard.expense.amountMinor).toBe(0n);
    expect(dashboard.savings.amountMinor).toBe(0n);
    expect(dashboard.savingRatePercent).toBeUndefined();
    expect(dashboard.expenseTrend.previous.amountMinor).toBe(89_640n);
    expect(dashboard.monthStatus).toBe("NESSUN BUDGET");
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

  it("conta solo i conti liquidi attivi inclusi nella disponibilità EUR", () => {
    const accounts = [
      account("checking", { openingBalance: Money.fromMinor(100_000n, "EUR") }),
      account("savings", { type: "savings", openingBalance: Money.fromMinor(200_000n, "EUR") }),
      account("cash", { openingBalance: Money.fromMinor(300_000n, "EUR") }),
      account("usd", { currency: "USD", openingBalance: Money.fromMinor(900n, "USD") }),
      account("investment", {
        type: "investment",
        openingBalance: Money.fromMinor(500_000n, "EUR"),
      }),
      account("loan", { type: "loan", openingBalance: Money.fromMinor(700_000n, "EUR") }),
      account("archived", { isArchived: true, openingBalance: Money.fromMinor(800_000n, "EUR") }),
    ];
    const dashboard = buildDashboardViewModel(minimalData([], [], accounts));
    expect(dashboard.availableBalance.amountMinor).toBe(600_000n);
    expect(dashboard.activeLiquidAccountCount).toBe(3);
  });

  it.each([
    [120_000n, 40_000n, 80_000n, 66.66],
    [100_000n, 100_000n, 0n, 0],
    [40_000n, 120_000n, -80_000n, -200],
    [0n, 40_000n, -40_000n, undefined],
  ])("calcola risparmio e tasso senza valori floating o NaN", (income, expense, savings, rate) => {
    const dashboard = buildDashboardViewModel(
      minimalData([
        ...(income === 0n ? [] : [transaction("income", "income", income)]),
        ...(expense === 0n ? [] : [transaction("expense", "expense", expense)]),
      ]),
    );
    expect(dashboard.savings.amountMinor).toBe(savings);
    expect(dashboard.savingRatePercent).toBe(rate);
  });

  it("non aggrega budget con perimetri sovrapposti macro/sottocategoria", () => {
    const parent = Category.create({ id: "home", name: "Casa", kindScope: "expense" });
    const child = Category.create({
      id: "rent",
      name: "Affitto",
      kindScope: "expense",
      parentId: parent.id,
    });
    const dashboard = buildDashboardViewModel(
      minimalData(
        [transaction("rent-expense", "expense", 60_000n, "2026-08-10", child.id)],
        [budget("home-budget", 100_000n, parent.id), budget("rent-budget", 50_000n, child.id)],
        [account()],
        [parent, child],
      ),
    );
    expect(dashboard.budget.activeCount).toBe(2);
    expect(dashboard.budget.criticalCategories).toHaveLength(2);
    expect("spent" in dashboard.budget).toBe(false);
  });

  it.each([
    [40_000n, "IN LINEA"],
    [60_000n, "ATTENZIONE"],
    [85_000n, "FUORI PIANO"],
    [110_000n, "FUORI PIANO"],
  ])("deriva lo stato mese dal budget più critico", (spent, status) => {
    const dashboard = buildDashboardViewModel(
      minimalData([transaction("expense", "expense", spent)], [budget("monthly")]),
    );
    expect(dashboard.monthStatus).toBe(status);
  });

  it("espone separatamente debiti e rendimento degli investimenti", () => {
    const account = Account.create({
      id: "investment",
      name: "Conto investimento sintetico",
      type: "investment",
      currency: "EUR",
    });
    const loan = Loan.create({
      id: "loan",
      accountId: "loan-account",
      lender: "Finanziaria sintetica",
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
