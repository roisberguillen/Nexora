import { DomainError } from "../errors/DomainError";
import { currencyCode, type CurrencyCode } from "./CurrencyCode";

export interface SerializedMoney {
  readonly amountMinor: string;
  readonly currency: CurrencyCode;
}

export class Money {
  public readonly amountMinor: bigint;
  public readonly currency: CurrencyCode;

  private constructor(amountMinor: bigint, currency: CurrencyCode) {
    this.amountMinor = amountMinor;
    this.currency = currency;
    Object.freeze(this);
  }

  public static fromMinor(amountMinor: bigint, currency: string): Money {
    if (typeof amountMinor !== "bigint") {
      throw new DomainError(
        "invalid_money",
        "Money amount must be expressed as bigint minor units.",
      );
    }
    return new Money(amountMinor, currencyCode(currency));
  }

  public static zero(currency: string): Money {
    return Money.fromMinor(0n, currency);
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinor(this.amountMinor + other.amountMinor, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinor(this.amountMinor - other.amountMinor, this.currency);
  }

  public negate(): Money {
    return Money.fromMinor(-this.amountMinor, this.currency);
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  public isZero(): boolean {
    return this.amountMinor === 0n;
  }

  public isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  public isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  public toJSON(): SerializedMoney {
    return {
      amountMinor: this.amountMinor.toString(),
      currency: this.currency,
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError("currency_mismatch", "Money operations require the same currency.");
    }
  }
}
