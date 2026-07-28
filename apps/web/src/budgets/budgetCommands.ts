import { Budget, Money, type LedgerRepository } from "@nexora/domain";

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
