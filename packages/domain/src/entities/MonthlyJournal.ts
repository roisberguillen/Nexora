import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface CreateMonthlyJournalProps {
  readonly id: string;
  readonly period: string;
  readonly note?: string;
  readonly nextMonthGoals?: string;
  readonly perceivedControl?: 1 | 2 | 3 | 4 | 5;
}

export class MonthlyJournal {
  public readonly id: string;
  public readonly period: string;
  public readonly note: string | undefined;
  public readonly nextMonthGoals: string | undefined;
  public readonly perceivedControl: 1 | 2 | 3 | 4 | 5 | undefined;
  private constructor(props: CreateMonthlyJournalProps) {
    this.id = requireIdentifier(props.id, "Monthly journal id");
    if (!periodPattern.test(props.period))
      throw new DomainError("invalid_transaction", "Journal period is invalid.");
    this.period = props.period;
    this.note = normalize(props.note);
    this.nextMonthGoals = normalize(props.nextMonthGoals);
    this.perceivedControl = props.perceivedControl;
    Object.freeze(this);
  }
  public static create(props: CreateMonthlyJournalProps): MonthlyJournal {
    return new MonthlyJournal(props);
  }
}
function normalize(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (normalized === undefined || normalized === "") return undefined;
  if (normalized.length > 4_000)
    throw new DomainError("invalid_transaction", "Journal text is too long.");
  return normalized;
}
