import { MonthlyJournal, type LedgerRepository } from "@nexora/domain";

export interface MonthlyJournalInput {
  readonly period: string;
  readonly note?: string;
  readonly nextMonthGoals?: string;
  readonly perceivedControl?: 1 | 2 | 3 | 4 | 5;
}

export async function saveMonthlyJournal(
  repository: LedgerRepository,
  input: MonthlyJournalInput,
  existingId: string | undefined,
  idFactory: () => string = () => `journal-${crypto.randomUUID()}`,
): Promise<MonthlyJournal> {
  const journal = MonthlyJournal.create({
    id: existingId ?? idFactory(),
    period: input.period,
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.nextMonthGoals === undefined ? {} : { nextMonthGoals: input.nextMonthGoals }),
    ...(input.perceivedControl === undefined ? {} : { perceivedControl: input.perceivedControl }),
  });
  if (existingId === undefined) await repository.saveMonthlyJournal(journal);
  else await repository.updateMonthlyJournal(journal);
  return journal;
}

export async function deleteMonthlyJournal(
  repository: LedgerRepository,
  id: string,
): Promise<void> {
  await repository.deleteMonthlyJournal(id);
}
