import {
  LocalDate,
  Money,
  RecurringRule,
  type LedgerRepository,
  type ExpenseExceptionality,
  type ExpenseVariability,
  type RecurrenceUnit,
  type WeekendPolicy,
} from "@nexora/domain";

export interface RecurringRuleInput {
  readonly accountId: string;
  readonly amountMinor: bigint;
  readonly categoryId?: string;
  readonly enabled: boolean;
  readonly expenseExceptionality?: ExpenseExceptionality;
  readonly expenseVariability?: ExpenseVariability;
  readonly frequencyUnit?: RecurrenceUnit;
  readonly interval?: number;
  readonly kind: "income" | "expense";
  readonly name: string;
  readonly nextNominalDate?: string;
  /** Legacy editor field; translated to the nominal cursor by the domain. */
  readonly nextExpectedDate?: string;
  readonly nominalDay?: number;
  readonly nominalMonth?: number;
  readonly payee?: string;
  readonly weekendPolicy: WeekendPolicy;
}

export async function createRecurringRule(
  repository: LedgerRepository,
  input: RecurringRuleInput,
  idFactory: () => string = () => `recurring-${crypto.randomUUID()}`,
): Promise<RecurringRule> {
  const { nextNominalDate, nextExpectedDate, ...props } = input;
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const rule = RecurringRule.create({
    ...props,
    id: idFactory(),
    amount: Money.fromMinor(input.amountMinor, account.currency),
    ...(nextNominalDate === undefined
      ? { nextExpectedDate: LocalDate.parse(requiredDate(nextExpectedDate)) }
      : { nextNominalDate: LocalDate.parse(nextNominalDate) }),
  });
  await repository.saveRecurringRule(rule);
  return rule;
}

export async function updateRecurringRule(
  repository: LedgerRepository,
  id: string,
  input: RecurringRuleInput,
): Promise<RecurringRule> {
  const { nextNominalDate, nextExpectedDate, ...props } = input;
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const rule = RecurringRule.create({
    ...props,
    id,
    amount: Money.fromMinor(input.amountMinor, account.currency),
    ...(nextNominalDate === undefined
      ? { nextExpectedDate: LocalDate.parse(requiredDate(nextExpectedDate)) }
      : { nextNominalDate: LocalDate.parse(nextNominalDate) }),
  });
  await repository.updateRecurringRule(rule);
  return rule;
}

function requiredDate(value: string | undefined): string {
  if (value === undefined) throw new Error("Recurring rules require a next nominal date.");
  return value;
}
