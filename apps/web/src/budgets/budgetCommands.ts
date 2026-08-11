import { Budget, DomainError, Money, type LedgerRepository } from "@nexora/domain";

export interface BudgetInput {
  readonly amountMinor: bigint;
  readonly categoryId: string;
  readonly firstAlertPercentage: number;
  readonly secondAlertPercentage: number;
}

const currentPeriod = () =>
  new Intl.DateTimeFormat("sv-SE", {
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).format(new Date());

export async function createBudget(
  repository: LedgerRepository,
  input: BudgetInput,
  idFactory: () => string = () => `budget-${crypto.randomUUID()}`,
): Promise<Budget> {
  const budget = Budget.create({
    id: idFactory(),
    period: currentPeriod(),
    amount: Money.fromMinor(input.amountMinor, "EUR"),
    categoryId: input.categoryId,
    firstAlertPercentage: input.firstAlertPercentage,
    secondAlertPercentage: input.secondAlertPercentage,
  });
  await repository.saveBudget(budget);
  return budget;
}

export async function updateBudget(
  repository: LedgerRepository,
  id: string,
  input: BudgetInput,
): Promise<Budget> {
  const existing = (await repository.listBudgets()).find((budget) => budget.id === id);
  if (existing === undefined) {
    throw new DomainError("missing_reference", "Budget does not exist.");
  }
  const budget = Budget.create({
    id: existing.id,
    period: existing.period,
    amount: Money.fromMinor(input.amountMinor, existing.amount.currency),
    categoryId: input.categoryId,
    firstAlertPercentage: input.firstAlertPercentage,
    secondAlertPercentage: input.secondAlertPercentage,
  });
  await repository.updateBudget(budget);
  return budget;
}

export async function deleteBudget(repository: LedgerRepository, id: string): Promise<void> {
  await repository.deleteBudget(id);
}
