import {
  Account,
  DomainError,
  Money,
  type AccountType,
  type LedgerRepository,
} from "@nexora/domain";

export interface CreateLedgerAccountInput {
  readonly currency: string;
  readonly institution: string;
  readonly name: string;
  readonly openingBalanceMinor: bigint;
  readonly parentAccountId?: string;
  readonly type: AccountType;
}

export interface UpdateLedgerAccountInput {
  readonly institution: string;
  readonly name: string;
  readonly openingBalanceMinor?: bigint;
}

export async function createLedgerAccount(
  repository: LedgerRepository,
  input: CreateLedgerAccountInput,
  idFactory: () => string = defaultAccountId,
): Promise<Account> {
  const currency = input.currency.trim().toUpperCase();
  const institution = optionalInput(input.institution);
  const account = Account.create({
    id: idFactory(),
    name: input.name,
    type: input.type,
    currency,
    openingBalance: Money.fromMinor(input.openingBalanceMinor, currency),
    ...(institution === undefined ? {} : { institution }),
    ...(input.parentAccountId === undefined ? {} : { parentAccountId: input.parentAccountId }),
  });
  await repository.saveAccount(account);
  return account;
}

export async function updateLedgerAccount(
  repository: LedgerRepository,
  accountId: string,
  input: UpdateLedgerAccountInput,
): Promise<Account> {
  const existing = await requireAccount(repository, accountId);
  const openingBalance =
    input.openingBalanceMinor === undefined
      ? undefined
      : Money.fromMinor(input.openingBalanceMinor, existing.currency);
  const updated = existing.update({
    name: input.name,
    institution: optionalInput(input.institution) ?? null,
    ...(openingBalance === undefined ? {} : { openingBalance }),
  });
  await repository.updateAccount(updated);
  return updated;
}

export async function setLedgerAccountArchived(
  repository: LedgerRepository,
  accountId: string,
  isArchived: boolean,
): Promise<Account> {
  const existing = await requireAccount(repository, accountId);
  const updated = existing.update({ isArchived });
  await repository.updateAccount(updated);
  return updated;
}

export function parseLocalizedAmountMinor(value: string, currency: string): bigint {
  const normalized = value.trim().replaceAll("\u00a0", "").replaceAll(" ", "");
  const match = /^([+-]?)(\d+)(?:[,.](\d+))?$/.exec(normalized);
  if (match === null) {
    throw new DomainError(
      "invalid_money",
      "Inserisci un importo usando solo cifre e il separatore decimale.",
    );
  }

  const fractionDigits = currencyFractionDigits(currency);
  const fraction = match[3] ?? "";
  if (fraction.length > fractionDigits) {
    throw new DomainError(
      "invalid_money",
      `La valuta ${currency.toUpperCase()} accetta al massimo ${fractionDigits} decimali.`,
    );
  }

  const scale = 10n ** BigInt(fractionDigits);
  const major = BigInt(match[2] ?? "0") * scale;
  const paddedFraction = fraction.padEnd(fractionDigits, "0");
  const minor = major + BigInt(paddedFraction === "" ? "0" : paddedFraction);
  return match[1] === "-" ? -minor : minor;
}

export function formatEditableAmountMinor(amountMinor: bigint, currency: string): string {
  const fractionDigits = currencyFractionDigits(currency);
  const sign = amountMinor < 0n ? "-" : "";
  const absoluteDigits = (amountMinor < 0n ? -amountMinor : amountMinor)
    .toString()
    .padStart(fractionDigits + 1, "0");

  if (fractionDigits === 0) {
    return `${sign}${absoluteDigits}`;
  }

  const separatorIndex = absoluteDigits.length - fractionDigits;
  return `${sign}${absoluteDigits.slice(0, separatorIndex)},${absoluteDigits.slice(separatorIndex)}`;
}

function currencyFractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat("it-IT", {
      currency: currency.trim().toUpperCase(),
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

function optionalInput(value: string): string | undefined {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

async function requireAccount(repository: LedgerRepository, accountId: string): Promise<Account> {
  const account = await repository.findAccountById(accountId);
  if (account === undefined) {
    throw new DomainError("missing_reference", "Account does not exist.");
  }
  return account;
}

function defaultAccountId(): string {
  return `account-${crypto.randomUUID()}`;
}
