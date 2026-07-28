import { DomainError } from "../errors/DomainError";
import { normalizeOptionalText, requireIdentifier } from "../validation";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";

export interface CreateLoanProps {
  readonly id: string;
  readonly accountId: string;
  readonly lender: string;
  readonly installment: Money;
  readonly remainingPrincipal: Money;
  readonly originalPrincipal?: Money;
  readonly annualNominalRateBps?: number;
  readonly annualEffectiveRateBps?: number;
  readonly installmentsPaid?: number;
  readonly installmentsRemaining?: number;
  readonly nextDueDate?: LocalDate;
}

export class Loan {
  public readonly id: string;
  public readonly accountId: string;
  public readonly lender: string;
  public readonly installment: Money;
  public readonly remainingPrincipal: Money;
  public readonly originalPrincipal: Money | undefined;
  public readonly annualNominalRateBps: number | undefined;
  public readonly annualEffectiveRateBps: number | undefined;
  public readonly installmentsPaid: number | undefined;
  public readonly installmentsRemaining: number | undefined;
  public readonly nextDueDate: LocalDate | undefined;

  private constructor(props: CreateLoanProps) {
    this.id = requireIdentifier(props.id, "Loan id");
    this.accountId = requireIdentifier(props.accountId, "Loan account id");
    this.lender = requireLender(props.lender);
    this.installment = props.installment;
    this.remainingPrincipal = props.remainingPrincipal;
    this.originalPrincipal = props.originalPrincipal;
    this.annualNominalRateBps = optionalRate(props.annualNominalRateBps, "TAN");
    this.annualEffectiveRateBps = optionalRate(props.annualEffectiveRateBps, "TAEG");
    this.installmentsPaid = optionalCount(props.installmentsPaid, "Paid installments");
    this.installmentsRemaining = optionalCount(
      props.installmentsRemaining,
      "Remaining installments",
    );
    this.nextDueDate = props.nextDueDate;
    if (!this.installment.isPositive())
      throw new DomainError("invalid_money", "Loan installment must be positive.");
    if (this.remainingPrincipal.isNegative())
      throw new DomainError("invalid_money", "Loan principal cannot be negative.");
    if (this.originalPrincipal !== undefined) {
      if (!this.originalPrincipal.isPositive())
        throw new DomainError("invalid_money", "Original principal must be positive.");
      if (
        this.originalPrincipal.currency !== this.remainingPrincipal.currency ||
        this.installment.currency !== this.remainingPrincipal.currency
      )
        throw new DomainError("currency_mismatch", "Loan amounts must share a currency.");
      if (this.remainingPrincipal.amountMinor > this.originalPrincipal.amountMinor)
        throw new DomainError(
          "invalid_money",
          "Remaining principal cannot exceed original principal.",
        );
    } else if (this.installment.currency !== this.remainingPrincipal.currency) {
      throw new DomainError("currency_mismatch", "Loan amounts must share a currency.");
    }
    Object.freeze(this);
  }

  public static create(props: CreateLoanProps): Loan {
    return new Loan(props);
  }

  public progressPercent(): number | undefined {
    if (this.originalPrincipal === undefined) return undefined;
    return (
      Number(
        ((this.originalPrincipal.amountMinor - this.remainingPrincipal.amountMinor) * 10_000n) /
          this.originalPrincipal.amountMinor,
      ) / 100
    );
  }
}

function requireLender(value: string): string {
  const lender = normalizeOptionalText(value, 120);
  if (lender === undefined) throw new DomainError("invalid_identifier", "Loan lender is required.");
  return lender;
}
function optionalRate(value: number | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000)
    throw new DomainError("invalid_money", `${name} must be a valid basis-point rate.`);
  return value;
}
function optionalCount(value: number | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0)
    throw new DomainError("invalid_identifier", `${name} must be a non-negative integer.`);
  return value;
}
