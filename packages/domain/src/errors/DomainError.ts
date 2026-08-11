export type DomainErrorCode =
  | "currency_mismatch"
  | "duplicate_entity"
  | "invalid_account"
  | "invalid_category"
  | "invalid_currency"
  | "invalid_date"
  | "invalid_identifier"
  | "invalid_import"
  | "invalid_money"
  | "invalid_percentage"
  | "invalid_transaction"
  | "invalid_transfer"
  | "missing_reference";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;

  public constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}
