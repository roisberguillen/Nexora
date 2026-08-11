import { Budget, DomainError, Money, type LedgerRepository } from "@nexora/domain";

export interface BudgetInput {
  readonly amountMinor: bigint;
  readonly alertAt80: boolean;
  readonly alertAt100: boolean;
  readonly categoryId?: string;
  readonly period: string;
}

export async function createBudget(
  repository: LedgerRepository,
  input: BudgetInput,
  idFactory: () => string = () => `budget-${crypto.randomUUID()}`,
): Promise<Budget> {
  const budget = Budget.create({
    id: idFactory(),
    period: input.period,
    amount: Money.fromMinor(input.amountMinor, "EUR"),
    alertAt80: input.alertAt80,
    alertAt100: input.alertAt100,
    ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
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
    period: input.period,
    amount: Money.fromMinor(input.amountMinor, existing.amount.currency),
    alertAt80: input.alertAt80,
    alertAt100: input.alertAt100,
    ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
  });
  await repository.updateBudget(budget);
  return budget;
}

export async function deleteBudget(repository: LedgerRepository, id: string): Promise<void> {
  await repository.deleteBudget(id);
}
