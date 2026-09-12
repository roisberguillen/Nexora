import {
  calculatePrudentExpenseForecast,
  categoryLabel,
  financialPeriodForDate,
  LocalDate,
  Money,
  summarizeCashFlow,
  type Category,
  type Transaction,
  type TransactionSplit,
} from "@nexora/domain";
import { formatFinancialPeriod } from "../date/financialPeriodPresentation";

const defaultCurrency = "EUR";

export type AnalyticsTrendWindow = 3 | 6 | 12;
export type AnalyticsComparisonTone = "positive" | "negative" | "neutral";

export interface AnalyticsCategoryItem {
  readonly id: string;
  readonly label: string;
  readonly amount: Money;
  readonly percentage: number;
  readonly delta: Money | undefined;
  readonly tone: AnalyticsComparisonTone;
}

export interface AnalyticsTrendItem {
  readonly month: string;
  readonly income: Money;
  readonly expense: Money;
  readonly savings: Money;
  readonly expenseBarPercent: number;
  readonly isSelected: boolean;
}

export interface AnalyticsInsight {
  readonly id: string;
  readonly label: string;
  readonly amount: Money;
  readonly tone: AnalyticsComparisonTone;
}

export interface AnalyticsViewModel {
  readonly selectedPeriod: string;
  readonly selectedPeriodLabel: string;
  readonly previousPeriod: string;
  readonly previousPeriodLabel: string;
  readonly currency: string;
  readonly monthlySummary: ReturnType<typeof summarizeCashFlow>;
  readonly previousSummary: ReturnType<typeof summarizeCashFlow>;
  readonly savingRatePercent: number | undefined;
  readonly previousSavingRatePercent: number | undefined;
  readonly comparisonAvailable: boolean;
  readonly trendWindow: AnalyticsTrendWindow;
  readonly trends: readonly AnalyticsTrendItem[];
  readonly averageExpense: Money;
  readonly averageExpenseDelta: Money;
  readonly categories: readonly AnalyticsCategoryItem[];
  readonly insights: readonly AnalyticsInsight[];
  readonly history: readonly AnalyticsTrendItem[];
  readonly forecast: ReturnType<typeof calculatePrudentExpenseForecast>;
  readonly hasLedgerData: boolean;
  readonly hasSelectedPeriodData: boolean;
}

export interface AnalyticsLedgerData {
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transactionSplits: readonly TransactionSplit[];
  readonly financialMonthStartDay?: number;
}

export function buildAnalyticsViewModel(
  data: AnalyticsLedgerData,
  selectedPeriod: string,
  trendWindow: AnalyticsTrendWindow = 6,
  currency = defaultCurrency,
  financialMonthStartDay = 1,
): AnalyticsViewModel {
  const periods = monthRange(selectedPeriod, 12);
  const previousPeriod = shiftMonth(selectedPeriod, -1);
  const currentTransactions = transactionsForPeriod(
    data.transactions,
    selectedPeriod,
    financialMonthStartDay,
  );
  const previousTransactions = transactionsForPeriod(
    data.transactions,
    previousPeriod,
    financialMonthStartDay,
  );
  const monthlySummary = summarizeCashFlow(currentTransactions, currency);
  const previousSummary = summarizeCashFlow(previousTransactions, currency);
  const selectedTrends = periods
    .slice(-trendWindow)
    .map((month) =>
      trendForPeriod(data, month, currency, month === selectedPeriod, financialMonthStartDay),
    );
  const history = periods.map((month) =>
    trendForPeriod(data, month, currency, month === selectedPeriod, financialMonthStartDay),
  );
  const maximumExpense = selectedTrends.reduce(
    (maximum, trend) => (trend.expense.amountMinor > maximum ? trend.expense.amountMinor : maximum),
    0n,
  );
  const trends = selectedTrends.map((trend) => ({
    ...trend,
    expenseBarPercent: boundedPercent(trend.expense.amountMinor, maximumExpense),
  }));
  const categories = buildCategories(
    data,
    selectedPeriod,
    previousPeriod,
    currency,
    financialMonthStartDay,
  );
  const averageExpense = averageMoney(
    trends.map((trend) => trend.expense),
    currency,
  );
  const averageExpenseDelta = monthlySummary.expense.subtract(averageExpense);

  return Object.freeze({
    selectedPeriod,
    selectedPeriodLabel: periodLabel(selectedPeriod, financialMonthStartDay),
    previousPeriod,
    previousPeriodLabel: periodLabel(previousPeriod, financialMonthStartDay),
    currency,
    monthlySummary,
    previousSummary,
    savingRatePercent: savingRate(monthlySummary),
    previousSavingRatePercent: savingRate(previousSummary),
    comparisonAvailable: previousTransactions.length > 0,
    trendWindow,
    trends: Object.freeze(trends),
    averageExpense,
    averageExpenseDelta,
    categories: Object.freeze(categories),
    insights: Object.freeze(buildInsights(monthlySummary, previousSummary, categories, currency)),
    history: Object.freeze(history),
    forecast: calculatePrudentExpenseForecast(data.transactions, currency),
    hasLedgerData: data.transactions.length > 0,
    hasSelectedPeriodData: currentTransactions.length > 0,
  });
}

export function currentAnalyticsPeriod(
  transactions: readonly Transaction[],
  today = new Date(),
  startDay = 1,
): string {
  const latest = transactions
    .filter((transaction) => transaction.amount.currency === defaultCurrency)
    .map((transaction) => financialPeriodForDate(transaction.bookedDate, startDay))
    .sort()
    .at(-1);
  if (latest !== undefined) return latest;
  return financialPeriodForDate(
    LocalDate.parse(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    ),
    startDay,
  );
}

export function shiftMonth(period: string, delta: number): string {
  const [yearText, monthText] = period.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period: string, startDay = 1): string {
  return formatFinancialPeriod(period, startDay);
}

function monthRange(endPeriod: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => shiftMonth(endPeriod, index - count + 1));
}

function transactionsForPeriod(
  transactions: readonly Transaction[],
  period: string,
  startDay = 1,
): readonly Transaction[] {
  return transactions.filter(
    (transaction) => financialPeriodForDate(transaction.bookedDate, startDay) === period,
  );
}

function trendForPeriod(
  data: AnalyticsLedgerData,
  period: string,
  currency: string,
  isSelected: boolean,
  startDay: number,
): AnalyticsTrendItem {
  const summary = summarizeCashFlow(
    transactionsForPeriod(data.transactions, period, startDay),
    currency,
  );
  return {
    month: period,
    income: summary.income,
    expense: summary.expense,
    savings: summary.net,
    expenseBarPercent: 0,
    isSelected,
  };
}

function buildCategories(
  data: AnalyticsLedgerData,
  period: string,
  previousPeriod: string,
  currency: string,
  startDay: number,
): readonly AnalyticsCategoryItem[] {
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const current = categoryAmounts(data, period, currency, startDay);
  const previous = categoryAmounts(data, previousPeriod, currency, startDay);
  const total = [...current.values()].reduce((sum, amount) => sum + amount, 0n);
  return [...current.entries()]
    .sort((left, right) =>
      right[1] > left[1] ? 1 : right[1] < left[1] ? -1 : left[0].localeCompare(right[0]),
    )
    .slice(0, 5)
    .map(([id, amount]) => {
      const category = categoryById.get(id);
      const deltaMinor = amount - (previous.get(id) ?? 0n);
      return Object.freeze({
        id,
        label:
          category === undefined ? "Non categorizzato" : categoryLabel(category, data.categories),
        amount: Money.fromMinor(amount, currency),
        percentage: boundedPercent(amount, total),
        delta:
          previous.has(id) || amount !== 0n ? Money.fromMinor(deltaMinor, currency) : undefined,
        tone: deltaMinor > 0n ? "negative" : deltaMinor < 0n ? "positive" : "neutral",
      });
    });
}

function categoryAmounts(
  data: AnalyticsLedgerData,
  period: string,
  currency: string,
  startDay: number,
): Map<string, bigint> {
  const amounts = new Map<string, bigint>();
  const splitsByTransaction = new Map<string, TransactionSplit[]>();
  for (const split of data.transactionSplits) {
    const rows = splitsByTransaction.get(split.transactionId) ?? [];
    rows.push(split);
    splitsByTransaction.set(split.transactionId, rows);
  }
  for (const transaction of transactionsForPeriod(data.transactions, period, startDay)) {
    if (
      transaction.kind !== "expense" ||
      !transaction.affectsIncomeExpense() ||
      transaction.amount.currency !== currency
    )
      continue;
    const splits = splitsByTransaction.get(transaction.id);
    if (splits !== undefined && splits.length > 0) {
      for (const split of splits) addAmount(amounts, split.categoryId, -split.amount.amountMinor);
    } else {
      addAmount(
        amounts,
        transaction.categoryId ?? "uncategorized",
        -transaction.amount.amountMinor,
      );
    }
  }
  return amounts;
}

function addAmount(map: Map<string, bigint>, id: string, amount: bigint): void {
  map.set(id, (map.get(id) ?? 0n) + amount);
}

function buildInsights(
  current: ReturnType<typeof summarizeCashFlow>,
  previous: ReturnType<typeof summarizeCashFlow>,
  categories: readonly AnalyticsCategoryItem[],
  currency: string,
): readonly AnalyticsInsight[] {
  const expenseDelta = current.expense.subtract(previous.expense);
  const savingsDelta = current.net.subtract(previous.net);
  const incomeDelta = current.income.subtract(previous.income);
  const candidates: AnalyticsInsight[] = [
    {
      id: "expenses",
      label: "Spese rispetto al mese precedente",
      amount: expenseDelta,
      tone: expenseDelta.isNegative()
        ? "positive"
        : expenseDelta.isPositive()
          ? "negative"
          : "neutral",
    },
    {
      id: "savings",
      label: "Risparmio rispetto al mese precedente",
      amount: savingsDelta,
      tone: savingsDelta.isPositive()
        ? "positive"
        : savingsDelta.isNegative()
          ? "negative"
          : "neutral",
    },
    {
      id: "income",
      label: "Entrate rispetto al mese precedente",
      amount: incomeDelta,
      tone: incomeDelta.isPositive()
        ? "positive"
        : incomeDelta.isNegative()
          ? "negative"
          : "neutral",
    },
    ...categories
      .filter((category) => category.delta !== undefined && !category.delta.isZero())
      .map((category) => ({
        id: `category-${category.id}`,
        label: `${category.label} rispetto al mese precedente`,
        amount: category.delta ?? Money.zero(currency),
        tone: category.tone,
      })),
  ];
  return candidates
    .filter((insight) => !insight.amount.isZero())
    .sort((left, right) =>
      magnitude(right.amount.amountMinor) > magnitude(left.amount.amountMinor) ? 1 : -1,
    )
    .slice(0, 4);
}

function magnitude(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function averageMoney(values: readonly Money[], currency: string): Money {
  const total = values.reduce((sum, value) => sum + value.amountMinor, 0n);
  return Money.fromMinor(values.length === 0 ? 0n : total / BigInt(values.length), currency);
}

function savingRate(summary: ReturnType<typeof summarizeCashFlow>): number | undefined {
  if (summary.income.isZero()) return undefined;
  return Number((summary.net.amountMinor * 10_000n) / summary.income.amountMinor) / 100;
}

function boundedPercent(value: bigint, maximum: bigint): number {
  if (value <= 0n || maximum <= 0n) return 0;
  return Number((value * 10_000n) / maximum) / 100;
}
