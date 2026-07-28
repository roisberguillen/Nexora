import { DomainError, type DomainErrorCode } from "./errors/DomainError";

export function requireIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 128) {
    throw new DomainError("invalid_identifier", `${label} must contain 1 to 128 characters.`);
  }
  return normalized;
}

export function requireName(
  value: string,
  label: string,
  code: DomainErrorCode = "invalid_identifier",
): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 160) {
    throw new DomainError(code, `${label} must contain 1 to 160 characters.`);
  }
  return normalized;
}

export function normalizeOptionalText(
  value: string | undefined,
  maxLength: number,
  code: DomainErrorCode = "invalid_transaction",
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new DomainError(code, `Text must not exceed ${maxLength} characters.`);
  }
  return normalized;
}
