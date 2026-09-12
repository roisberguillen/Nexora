import {
  calculateAccountBalance,
  calculateBudgetProgress,
  calculateTotalBalance,
  categoryLabel,
  financialPeriodForDate,
  LocalDate,
  Money,
  resolveActiveBudgetsForPeriod,
  summarizeCashFlow,
  type Account,
  type Budget,
  type Category,
  type InvestmentPosition,
  type Loan,
  type RecurringRule,
  type Transaction,
  type TransactionKind,
  type TransactionSplit,
  type TransactionStatus,
  type Transfer,
} from "@nexora/domain";
import { formatFinancialPeriod } from "../date/financialPeriodPresentation";

const defaultCurrency = "EUR";
const recentActivityLimit = 5;
const dashboardTimeZone = "Europe/Rome";

export interface DashboardLedgerData {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly Transfer[];
  readonly loans?: readonly Loan[];
  readonly investmentPositions?: readonly InvestmentPosition[];
  readonly budgets?: readonly Budget[];
  readonly recurringRules?: readonly RecurringRule[];
  readonly transactionSplits?: readonly TransactionSplit[];
  readonly financialMonthStartDay?: number;
}
export interface DashboardCounts {
  readonly accounts: number;
  readonly categories: number;
  readonly transactions: number;
  readonly transfers: number;
}
export type DashboardActivityTone = "negative" | "neutral" | "positive";
export interface DashboardAccountItem {
  readonly balance: Money;
  readonly id: string;
  readonly institution: string | undefined;
  readonly isArchived: boolean;
  readonly name: string;
  readonly typeLabel: string;
}
export interface DashboardActivityItem {
  readonly accountLabel: string;
  readonly amount: Money;
  readonly bookedDate: string;
  readonly categoryLabel: string;
  readonly id: string;
  readonly isCancelled: boolean;
  readonly kindLabel: string;
  readonly title: string;
  readonly tone: DashboardActivityTone;
}
export interface DashboardBudgetCategory {
  readonly id: string;
  readonly label: string;
  readonly percentage: number;
  readonly status: string;
}
export interface DashboardBudgetSummary {
  readonly activeCount: number;
  readonly attentionCount: number;
  readonly criticalCategories: readonly DashboardBudgetCategory[];
}
export interface DashboardUpcomingExpense {
  readonly id: string;
  readonly name: string;
  readonly amount: Money;
  readonly expectedDate: string;
  readonly daysUntil: number;
}
export interface DashboardExpenseTrend {
  readonly current: Money;
  readonly previous: Money;
  readonly difference: Money;
  readonly differencePercent: number | undefined;
}
export interface DashboardCategorySummary {
  readonly id: string;
  readonly label: string;
  readonly amount: Money;
  readonly percentageOfExpenses: number;
}
export interface DashboardViewModel {
  readonly accounts: readonly DashboardAccountItem[];
  readonly activity: readonly DashboardActivityItem[];
  readonly counts: DashboardCounts;
  readonly currency: string;
  readonly excludedCurrencyAccountCount: number;
  readonly expense: Money;
  readonly income: Money;
  readonly netCashFlow: Money;
  readonly netWorth: Money;
  readonly loanBalance: Money;
  readonly investmentCostBasis: Money;
  readonly investmentValue: Money;
  readonly investmentGainLoss: Money;
  readonly investmentGainLossPercent: number | undefined;
  readonly period: string;
  readonly periodLabel: string;
  readonly monthStatus: "IN LINEA" | "ATTENZIONE" | "FUORI PIANO" | "NESSUN BUDGET";
  readonly availableBalance: Money;
  readonly activeLiquidAccountCount: number;
  readonly savings: Money;
  readonly savingRatePercent: number | undefined;
  readonly budget: DashboardBudgetSummary;
  readonly upcomingExpenses: readonly DashboardUpcomingExpense[];
  readonly expenseTrend: DashboardExpenseTrend;
  readonly topExpenseCategories: readonly DashboardCategorySummary[];
}

export function buildDashboardViewModel(
  data: DashboardLedgerData,
  currency = defaultCurrency,
  today: Date = new Date(),
): DashboardViewModel {
  const financialMonthStartDay = data.financialMonthStartDay ?? 1;
  const period = periodFor(today, financialMonthStartDay);
  const previousPeriod = previousMonth(period);
  const monthlyTransactions = transactionsForPeriod(
    data.transactions,
    period,
    financialMonthStartDay,
  );
  const cashFlow = summarizeCashFlow(monthlyTransactions, currency);
  const previousCashFlow = summarizeCashFlow(
    transactionsForPeriod(data.transactions, previousPeriod, financialMonthStartDay),
    currency,
  );
  const accountById = new Map(data.accounts.map((account) => [account.id, account]));
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const sum = (values: readonly Money[]) =>
    values.reduce((total, value) => total.add(value), Money.zero(currency));
  const splits = data.transactionSplits ?? [];
  const progress = resolveActiveBudgetsForPeriod(data.budgets ?? [], period).map((budget) => ({
    budget,
    progress: calculateBudgetProgress({
      budget,
      targetPeriod: period,
      categories: data.categories,
      transactions: data.transactions,
      splits,
      ...(data.financialMonthStartDay === undefined
        ? {}
        : { financialMonthStartDay: data.financialMonthStartDay }),
    }),
  }));
  const liquidAccounts = data.accounts.filter(
    (account) =>
      !account.isArchived &&
      account.currency === currency &&
      ["checking", "savings", "cash"].includes(account.type),
  );
  const compatibleInvestments = (data.investmentPositions ?? []).filter(
    (position) => position.currentValue.currency === currency,
  );
  const investmentCostBasis = sum(compatibleInvestments.map((position) => position.costBasis));
  const investmentValue = sum(compatibleInvestments.map((position) => position.currentValue));
  const investmentGainLoss = sum(compatibleInvestments.map((position) => position.gainLoss()));
  const savings = cashFlow.net;
  return Object.freeze({
    accounts: Object.freeze(
      data.accounts
        .map((account) =>
          Object.freeze({
            balance: calculateAccountBalance(account, data.transactions),
            id: account.id,
            institution: account.institution,
            isArchived: account.isArchived,
            name: account.name,
            typeLabel: accountTypeLabel(account.type),
          }),
        )
        .sort(compareAccounts),
    ),
    activity: Object.freeze(
      buildActivity(data.transactions, data.transfers, accountById, categoryById)
        .sort(compareActivity)
        .slice(0, recentActivityLimit),
    ),
    counts: Object.freeze({
      accounts: data.accounts.length,
      categories: data.categories.length,
      transactions: data.transactions.length,
      transfers: data.transfers.length,
    }),
    currency,
    excludedCurrencyAccountCount: data.accounts.filter((account) => account.currency !== currency)
      .length,
    expense: cashFlow.expense,
    income: cashFlow.income,
    netCashFlow: savings,
    netWorth: calculateTotalBalance(data.accounts, data.transactions, currency),
    loanBalance: sum(
      (data.loans ?? [])
        .filter((loan) => loan.remainingPrincipal.currency === currency)
        .map((loan) => loan.remainingPrincipal),
    ),
    investmentCostBasis,
    investmentValue,
    investmentGainLoss,
    investmentGainLossPercent:
      investmentCostBasis.amountMinor > 0n
        ? Number((investmentGainLoss.amountMinor * 10_000n) / investmentCostBasis.amountMinor) / 100
        : undefined,
    period,
    periodLabel: formatFinancialPeriod(period, financialMonthStartDay),
    monthStatus: monthStatus(progress),
    availableBalance: sum(
      liquidAccounts.map((account) => calculateAccountBalance(account, data.transactions)),
    ),
    activeLiquidAccountCount: liquidAccounts.length,
    savings,
    savingRatePercent:
      cashFlow.income.amountMinor > 0n
        ? Number((savings.amountMinor * 10_000n) / cashFlow.income.amountMinor) / 100
        : undefined,
    budget: buildBudgetSummary(progress, currency, data.categories),
    upcomingExpenses: buildUpcomingExpenses(data.recurringRules ?? [], today, currency),
    expenseTrend: {
      current: cashFlow.expense,
      previous: previousCashFlow.expense,
      difference: cashFlow.expense.subtract(previousCashFlow.expense),
      differencePercent:
        previousCashFlow.expense.amountMinor > 0n
          ? Number(
              (cashFlow.expense.subtract(previousCashFlow.expense).amountMinor * 10_000n) /
                previousCashFlow.expense.amountMinor,
            ) / 100
          : undefined,
    },
    topExpenseCategories: buildTopCategories(
      monthlyTransactions,
      splits,
      data.categories,
      currency,
    ),
  });
}

function periodFor(today: Date, startDay = 1): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: dashboardTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);
  const date = LocalDate.parse(
    `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value ?? "01"}`,
  );
  return financialPeriodForDate(date, startDay);
}
function previousMonth(period: string): string {
  const [rawYear, rawMonth] = period.split("-").map(Number);
  const year = rawYear ?? 1970;
  const month = rawMonth ?? 1;
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}
function transactionsForPeriod(
  transactions: readonly Transaction[],
  period: string,
  startDay = 1,
): Transaction[] {
  return transactions.filter(
    (transaction) => financialPeriodForDate(transaction.bookedDate, startDay) === period,
  );
}
function monthStatus(
  items: readonly { progress: { status: string } }[],
): DashboardViewModel["monthStatus"] {
  if (items.length === 0) return "NESSUN BUDGET";
  if (items.some(({ progress }) => progress.status === "over_budget")) return "FUORI PIANO";
  if (items.some(({ progress }) => progress.status === "critical")) return "FUORI PIANO";
  if (items.some(({ progress }) => progress.status === "warning")) return "ATTENZIONE";
  return "IN LINEA";
}
function buildBudgetSummary(
  items: readonly { budget: Budget; progress: ReturnType<typeof calculateBudgetProgress> }[],
  currency: string,
  categories: readonly Category[],
): DashboardBudgetSummary {
  const criticalCategories = items
    .filter(({ progress }) => progress.status !== "normal")
    .map(({ budget, progress }) => ({
      id: budget.id,
      label:
        budget.categoryId === undefined
          ? "Tutte le categorie"
          : categoryLabel(
              categories.find((category) => category.id === budget.categoryId) ?? {
                id: budget.categoryId,
                name: "Categoria",
                parentId: undefined,
              },
              categories,
            ),
      percentage: progress.percentage,
      status:
        progress.status === "over_budget"
          ? "FUORI BUDGET"
          : progress.status === "critical"
            ? "CRITICO"
            : "ATTENZIONE",
    }))
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, 3);
  return {
    activeCount: items.length,
    attentionCount: items.filter(({ progress }) => progress.status !== "normal").length,
    criticalCategories,
  };
}
function buildUpcomingExpenses(
  rules: readonly RecurringRule[],
  today: Date,
  currency: string,
): DashboardUpcomingExpense[] {
  const todayDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: dashboardTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  return rules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.kind === "expense" &&
        rule.amount.currency === currency &&
        rule.nextExpectedDate.toString() > todayDate,
    )
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      amount: rule.amount.negate(),
      expectedDate: rule.nextExpectedDate.toString(),
      daysUntil: daysBetween(todayDate, rule.nextExpectedDate.toString()),
    }))
    .sort(
      (left, right) =>
        left.expectedDate.localeCompare(right.expectedDate) || left.id.localeCompare(right.id),
    )
    .slice(0, 3);
}
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
function buildTopCategories(
  transactions: readonly Transaction[],
  splits: readonly TransactionSplit[],
  categories: readonly Category[],
  currency: string,
): DashboardCategorySummary[] {
  const splitByTransaction = new Map<string, TransactionSplit[]>();
  for (const split of splits)
    splitByTransaction.set(split.transactionId, [
      ...(splitByTransaction.get(split.transactionId) ?? []),
      split,
    ]);
  const totals = new Map<string, Money>();
  let total = Money.zero(currency);
  for (const transaction of transactions) {
    if (
      transaction.kind !== "expense" ||
      !transaction.affectsIncomeExpense() ||
      transaction.amount.currency !== currency
    )
      continue;
    const rows = splitByTransaction.get(transaction.id);
    const amounts = rows?.length
      ? rows.map((row) => ({ id: row.categoryId, amount: row.amount.negate() }))
      : [{ id: transaction.categoryId ?? "uncategorized", amount: transaction.amount.negate() }];
    for (const item of amounts) {
      total = total.add(item.amount);
      totals.set(item.id, (totals.get(item.id) ?? Money.zero(currency)).add(item.amount));
    }
  }
  return [...totals.entries()]
    .map(([id, amount]) => ({
      id,
      label:
        id === "uncategorized"
          ? "Senza categoria"
          : categoryLabel(
              categories.find((category) => category.id === id) ?? {
                id,
                name: "Categoria",
                parentId: undefined,
              },
              categories,
            ),
      amount,
      percentageOfExpenses:
        total.amountMinor > 0n
          ? Number((amount.amountMinor * 10_000n) / total.amountMinor) / 100
          : 0,
    }))
    .sort((left, right) =>
      right.amount.amountMinor === left.amount.amountMinor
        ? left.id.localeCompare(right.id)
        : right.amount.amountMinor > left.amount.amountMinor
          ? 1
          : -1,
    )
    .slice(0, 3);
}
function buildActivity(
  transactions: readonly Transaction[],
  transfers: readonly Transfer[],
  accountById: ReadonlyMap<string, Account>,
  categoryById: ReadonlyMap<string, Category>,
): DashboardActivityItem[] {
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const transferLegIds = new Set(
    transfers.flatMap((transfer) => [transfer.debitTransactionId, transfer.creditTransactionId]),
  );
  const activity = transactions
    .filter((transaction) => !transferLegIds.has(transaction.id))
    .map((transaction) => transactionActivity(transaction, accountById, categoryById));
  for (const transfer of transfers) {
    const debit = transactionById.get(transfer.debitTransactionId);
    const credit = transactionById.get(transfer.creditTransactionId);
    if (debit === undefined || credit === undefined)
      throw new Error("A persisted transfer is missing one or more ledger legs.");
    activity.push(transferActivity(transfer, debit, credit, accountById));
  }
  return activity;
}
function transactionActivity(
  transaction: Transaction,
  accountById: ReadonlyMap<string, Account>,
  categoryById: ReadonlyMap<string, Category>,
): DashboardActivityItem {
  const category =
    transaction.categoryId === undefined ? undefined : categoryById.get(transaction.categoryId);
  return {
    accountLabel: accountById.get(transaction.accountId)?.name ?? "Conto non disponibile",
    amount: transaction.amount,
    bookedDate: transaction.bookedDate.value,
    categoryLabel: category?.name ?? fallbackCategoryLabel(transaction.kind),
    id: transaction.id,
    isCancelled: transaction.status === "cancelled",
    kindLabel: transactionKindLabel(transaction.kind, transaction.status),
    title:
      transaction.payee ??
      transaction.description ??
      transactionKindLabel(transaction.kind, transaction.status),
    tone: transactionTone(transaction.kind),
  };
}
function transferActivity(
  transfer: Transfer,
  debit: Transaction,
  credit: Transaction,
  accountById: ReadonlyMap<string, Account>,
): DashboardActivityItem {
  return {
    accountLabel: `${accountById.get(debit.accountId)?.name ?? "Conto non disponibile"} → ${accountById.get(credit.accountId)?.name ?? "Conto non disponibile"}`,
    amount: debit.amount.negate(),
    bookedDate: debit.bookedDate.value,
    categoryLabel: "Trasferimento interno",
    id: transfer.id,
    isCancelled: debit.status === "cancelled",
    kindLabel: transactionKindLabel("transfer", debit.status),
    title: debit.description ?? "Trasferimento interno",
    tone: "neutral",
  };
}
function compareAccounts(left: DashboardAccountItem, right: DashboardAccountItem): number {
  if (left.isArchived !== right.isArchived) return left.isArchived ? 1 : -1;
  return left.name.localeCompare(right.name, "it-IT");
}
function compareActivity(left: DashboardActivityItem, right: DashboardActivityItem): number {
  const byDate = right.bookedDate.localeCompare(left.bookedDate);
  return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
}
function transactionTone(kind: TransactionKind): DashboardActivityTone {
  return kind === "income" ? "positive" : kind === "expense" ? "negative" : "neutral";
}
function transactionKindLabel(kind: TransactionKind, status: TransactionStatus): string {
  if (status === "cancelled") return "Annullato";
  return kind === "income"
    ? "Entrata"
    : kind === "expense"
      ? "Spesa"
      : kind === "transfer"
        ? "Trasferimento"
        : "Rettifica";
}
function fallbackCategoryLabel(kind: TransactionKind): string {
  return kind === "transfer" ? "Trasferimento interno" : "Senza categoria";
}
function accountTypeLabel(type: Account["type"]): string {
  return type === "checking"
    ? "Conto corrente"
    : type === "savings"
      ? "Risparmio"
      : type === "cash"
        ? "Contanti"
        : type === "investment"
          ? "Investimenti"
          : type === "loan"
            ? "Prestito"
            : "Sottoconto";
}
