import { AllocationPlan, Money, type LedgerRepository } from "@nexora/domain";

export interface AllocationPlanInput {
  readonly amountMinor: bigint;
  readonly enabled: boolean;
  readonly name: string;
  readonly sourceAccountId: string;
  readonly targetAccountId: string;
  readonly trigger: "salary" | "photo_income";
}
export async function createAllocationPlan(
  repository: LedgerRepository,
  input: AllocationPlanInput,
  idFactory: () => string = () => `allocation-${crypto.randomUUID()}`,
): Promise<AllocationPlan> {
  const source = await repository.findAccountById(input.sourceAccountId);
  if (source === undefined) throw new Error("missing_source_account");
  const plan = AllocationPlan.create({
    ...input,
    id: idFactory(),
    amount: Money.fromMinor(input.amountMinor, source.currency),
  });
  await repository.saveAllocationPlan(plan);
  return plan;
}
