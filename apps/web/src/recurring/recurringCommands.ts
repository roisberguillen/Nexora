import {
  LocalDate,
  Money,
  RecurringRule,
  type LedgerRepository,
  type WeekendPolicy,
} from "@nexora/domain";

export interface RecurringRuleInput {
  readonly accountId: string;
  readonly amountMinor: bigint;
  readonly categoryId?: string;
  readonly enabled: boolean;
  readonly kind: "income" | "expense";
  readonly name: string;
  readonly nextExpectedDate: string;
  readonly nominalDay: number;
  readonly payee?: string;
  readonly weekendPolicy: WeekendPolicy;
}

export async function createRecurringRule(
  repository: LedgerRepository,
  input: RecurringRuleInput,
  idFactory: () => string = () => `recurring-${crypto.randomUUID()}`,
): Promise<RecurringRule> {
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const rule = RecurringRule.create({
    ...input,
    id: idFactory(),
    amount: Money.fromMinor(input.amountMinor, account.currency),
    nextExpectedDate: LocalDate.parse(input.nextExpectedDate),
  });
  await repository.saveRecurringRule(rule);
  return rule;
}

export async function updateRecurringRule(
  repository: LedgerRepository,
  id: string,
  input: RecurringRuleInput,
): Promise<RecurringRule> {
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const rule = RecurringRule.create({
    ...input,
    id,
    amount: Money.fromMinor(input.amountMinor, account.currency),
    nextExpectedDate: LocalDate.parse(input.nextExpectedDate),
  });
  await repository.updateRecurringRule(rule);
  return rule;
}
