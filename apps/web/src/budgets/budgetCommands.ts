import {
  Budget,
  DomainError,
  Money,
  financialPeriodForDate,
  LocalDate,
  nextBudgetPeriod,
  type LedgerRepository,
} from "@nexora/domain";

export interface BudgetInput {
  readonly amountMinor: bigint;
  readonly categoryId: string;
  readonly firstAlertPercentage: number;
  readonly secondAlertPercentage: number;
}

export function currentBudgetPeriod(today: Date = new Date(), startDay = 1): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(today);
  return financialPeriodForDate(
    LocalDate.parse(
      `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`,
    ),
    startDay,
  );
}

const defaultId = () => `budget-${crypto.randomUUID()}`;

function makeBudget(
  input: BudgetInput,
  props: {
    readonly id: string;
    readonly seriesId: string;
    readonly period: string;
    readonly currency?: string;
  },
): Budget {
  return Budget.create({
    id: props.id,
    seriesId: props.seriesId,
    period: props.period,
    amount: Money.fromMinor(input.amountMinor, props.currency ?? "EUR"),
    categoryId: input.categoryId,
    firstAlertPercentage: input.firstAlertPercentage,
    secondAlertPercentage: input.secondAlertPercentage,
  });
}

export async function createBudget(
  repository: LedgerRepository,
  input: BudgetInput,
  idFactory: () => string = defaultId,
  period = currentBudgetPeriod(),
): Promise<Budget> {
  const id = idFactory();
  const budget = makeBudget(input, { id, seriesId: id, period });
  await repository.saveBudget(budget);
  return budget;
}

/**
 * Same-month changes amend the revision. Changes in a later month close the old revision and
 * atomically open its successor, so earlier reporting remains immutable.
 */
export async function updateBudget(
  repository: LedgerRepository,
  id: string,
  input: BudgetInput,
  idFactory: () => string = defaultId,
  period = currentBudgetPeriod(),
): Promise<Budget> {
  const existing = (await repository.listBudgets()).find((budget) => budget.id === id);
  if (existing === undefined) {
    throw new DomainError("missing_reference", "Budget does not exist.");
  }
  if (period < existing.period) {
    throw new DomainError("invalid_date", "Historical budget revisions cannot be edited.");
  }
  if (period === existing.period) {
    const budget = makeBudget(input, {
      id: existing.id,
      seriesId: existing.seriesId,
      period: existing.period,
      currency: existing.amount.currency,
    });
    await repository.updateBudget(budget);
    return budget;
  }
  const closed = Budget.restore({
    id: existing.id,
    seriesId: existing.seriesId,
    period: existing.period,
    effectiveToPeriod: period,
    amount: existing.amount,
    ...(existing.categoryId === undefined ? {} : { categoryId: existing.categoryId }),
    ...(existing.firstAlertPercentage === undefined
      ? {}
      : { firstAlertPercentage: existing.firstAlertPercentage }),
    ...(existing.secondAlertPercentage === undefined
      ? {}
      : { secondAlertPercentage: existing.secondAlertPercentage }),
  });
  const budget = makeBudget(input, {
    id: idFactory(),
    seriesId: existing.seriesId,
    period,
    currency: existing.amount.currency,
  });
  await repository.reviseBudget(closed, budget);
  return budget;
}

/** Deactivation is non-destructive: current month stays visible, next month resolves no budget. */
export async function deactivateBudget(
  repository: LedgerRepository,
  id: string,
  period = currentBudgetPeriod(),
): Promise<void> {
  const existing = (await repository.listBudgets()).find((budget) => budget.id === id);
  if (existing === undefined) throw new DomainError("missing_reference", "Budget does not exist.");
  if (period < existing.period) throw new DomainError("invalid_date", "Budget is not active yet.");
  const effectiveToPeriod = nextBudgetPeriod(period);
  const closed = Budget.restore({
    id: existing.id,
    seriesId: existing.seriesId,
    period: existing.period,
    effectiveToPeriod,
    amount: existing.amount,
    ...(existing.categoryId === undefined ? {} : { categoryId: existing.categoryId }),
    ...(existing.firstAlertPercentage === undefined
      ? {}
      : { firstAlertPercentage: existing.firstAlertPercentage }),
    ...(existing.secondAlertPercentage === undefined
      ? {}
      : { secondAlertPercentage: existing.secondAlertPercentage }),
  });
  await repository.updateBudget(closed);
}

/** Retained only for administrative/test cleanup; normal UI uses deactivateBudget. */
export async function deleteBudget(repository: LedgerRepository, id: string): Promise<void> {
  await repository.deleteBudget(id);
}
