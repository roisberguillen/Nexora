import type { Account } from "../entities/Account";
import { DomainError } from "../errors/DomainError";

export interface AccountUpdateFacts {
  readonly hasActiveChildren: boolean;
  readonly hasEnabledAllocationPlans?: boolean;
  readonly hasTransactions: boolean;
  readonly parentIsArchived: boolean;
}

export function validateAccountUpdate(
  existing: Account,
  updated: Account,
  facts: AccountUpdateFacts,
): void {
  if (
    existing.id !== updated.id ||
    existing.type !== updated.type ||
    existing.currency !== updated.currency ||
    existing.parentAccountId !== updated.parentAccountId
  ) {
    throw new DomainError(
      "invalid_account",
      "Account type, currency and parent cannot change after creation.",
    );
  }

  if (!existing.openingBalance.equals(updated.openingBalance) && facts.hasTransactions) {
    throw new DomainError(
      "invalid_account",
      "Opening balance cannot change after the account has transactions.",
    );
  }

  if (!existing.isArchived && updated.isArchived && facts.hasActiveChildren) {
    throw new DomainError(
      "invalid_account",
      "An account with active subaccounts cannot be archived.",
    );
  }

  if (!existing.isArchived && updated.isArchived && facts.hasEnabledAllocationPlans) {
    throw new DomainError(
      "invalid_account",
      "An account used by an active allocation plan cannot be archived.",
    );
  }

  if (existing.isArchived && !updated.isArchived && facts.parentIsArchived) {
    throw new DomainError(
      "invalid_account",
      "A subaccount cannot be restored while its parent is archived.",
    );
  }
}
