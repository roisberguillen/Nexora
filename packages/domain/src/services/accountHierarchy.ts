import type { Account } from "../entities/Account";
import { DomainError } from "../errors/DomainError";

export function validateAccountHierarchy(accounts: readonly Account[]): void {
  const byId = new Map<string, Account>();
  for (const account of accounts) {
    if (byId.has(account.id))
      throw new DomainError("duplicate_entity", "Account ids must be unique.");
    byId.set(account.id, account);
  }
  for (const account of accounts) {
    if (account.parentAccountId === undefined) continue;
    const parent = byId.get(account.parentAccountId);
    if (parent === undefined)
      throw new DomainError("missing_reference", "Parent account does not exist.");
    if (parent.type === "virtual_subaccount")
      throw new DomainError("invalid_account", "Virtual subaccounts cannot be nested.");
    if (parent.currency !== account.currency)
      throw new DomainError(
        "currency_mismatch",
        "Virtual subaccounts must use the parent currency.",
      );
    if (parent.isArchived)
      throw new DomainError(
        "invalid_account",
        "Virtual subaccounts require an active parent account.",
      );
  }
}

export function sortAccountsParentFirst(accounts: readonly Account[]): readonly Account[] {
  return [...accounts].sort(
    (left, right) =>
      Number(left.parentAccountId !== undefined) - Number(right.parentAccountId !== undefined),
  );
}
