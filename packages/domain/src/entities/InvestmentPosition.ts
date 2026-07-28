import { DomainError } from "../errors/DomainError";
import { normalizeOptionalText, requireIdentifier } from "../validation";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";

export interface CreateInvestmentPositionProps {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly costBasis: Money;
  readonly currentValue: Money;
  readonly valuationDate: LocalDate;
  readonly symbol?: string;
  readonly units?: string;
}

export class InvestmentPosition {
  public readonly id: string;
  public readonly accountId: string;
  public readonly name: string;
  public readonly costBasis: Money;
  public readonly currentValue: Money;
  public readonly valuationDate: LocalDate;
  public readonly symbol: string | undefined;
  public readonly units: string | undefined;
  private constructor(props: CreateInvestmentPositionProps) {
    this.id = requireIdentifier(props.id, "Investment position id");
    this.accountId = requireIdentifier(props.accountId, "Investment account id");
    const name = normalizeOptionalText(props.name, 160);
    if (name === undefined)
      throw new DomainError("invalid_identifier", "Investment name is required.");
    this.name = name;
    this.costBasis = props.costBasis;
    this.currentValue = props.currentValue;
    this.valuationDate = props.valuationDate;
    this.symbol = normalizeOptionalText(props.symbol, 32);
    this.units = normalizeOptionalText(props.units, 48);
    if (this.costBasis.isNegative() || this.currentValue.isNegative())
      throw new DomainError("invalid_money", "Investment values cannot be negative.");
    if (this.costBasis.currency !== this.currentValue.currency)
      throw new DomainError("currency_mismatch", "Investment values must share a currency.");
    Object.freeze(this);
  }
  public static create(props: CreateInvestmentPositionProps): InvestmentPosition {
    return new InvestmentPosition(props);
  }
  public gainLoss(): Money {
    return this.currentValue.subtract(this.costBasis);
  }
  public gainLossPercent(): number | undefined {
    if (this.costBasis.isZero()) return undefined;
    return Number((this.gainLoss().amountMinor * 10_000n) / this.costBasis.amountMinor) / 100;
  }
}
