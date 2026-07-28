import { DomainError } from "../errors/DomainError";

declare const currencyCodeBrand: unique symbol;

export type CurrencyCode = string & { readonly [currencyCodeBrand]: true };

export function currencyCode(value: string): CurrencyCode {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new DomainError("invalid_currency", "Currency must be an uppercase ISO-4217 code.");
  }
  return value as CurrencyCode;
}
