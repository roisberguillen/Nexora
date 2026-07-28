import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";
import { Money } from "../value-objects/Money";
import type { Transaction } from "./Transaction";

export interface CreateTransactionSplitProps {
  readonly id: string;
  readonly transactionId: string;
  readonly categoryId: string;
  readonly amount: Money;
  readonly note?: string;
}

export class TransactionSplit {
  public readonly id: string;
  public readonly transactionId: string;
  public readonly categoryId: string;
  public readonly amount: Money;
  public readonly note: string | undefined;

  private constructor(props: CreateTransactionSplitProps) {
    this.id = requireIdentifier(props.id, "Transaction split id");
    this.transactionId = requireIdentifier(props.transactionId, "Transaction split transaction id");
    this.categoryId = requireIdentifier(props.categoryId, "Transaction split category id");
    this.amount = props.amount;
    this.note = props.note?.trim() || undefined;
    if (this.amount.isZero()) {
      throw new DomainError("invalid_transaction", "Transaction splits require a non-zero amount.");
    }
    Object.freeze(this);
  }

  public static create(props: CreateTransactionSplitProps): TransactionSplit {
    return new TransactionSplit(props);
  }
}

export function validateTransactionSplits(
  transaction: Transaction,
  splits: readonly TransactionSplit[],
): void {
  if (splits.length === 0) return;
  if (transaction.kind !== "income" && transaction.kind !== "expense") {
    throw new DomainError(
      "invalid_transaction",
      "Only income and expense transactions can have splits.",
    );
  }
  if (transaction.status === "cancelled") {
    throw new DomainError("invalid_transaction", "Cancelled transactions cannot receive splits.");
  }
  if (transaction.categoryId !== undefined) {
    throw new DomainError(
      "invalid_transaction",
      "Split transactions cannot have a direct category.",
    );
  }
  let total = 0n;
  const ids = new Set<string>();
  for (const split of splits) {
    if (split.transactionId !== transaction.id || !ids.add(split.id)) {
      throw new DomainError("invalid_transaction", "Split references are invalid.");
    }
    if (
      split.amount.currency !== transaction.amount.currency ||
      split.amount.isPositive() !== transaction.amount.isPositive()
    ) {
      throw new DomainError(
        "currency_mismatch",
        "Split currency and sign must match the transaction.",
      );
    }
    total += split.amount.amountMinor;
  }
  if (total !== transaction.amount.amountMinor) {
    throw new DomainError("invalid_transaction", "Split total must equal the transaction amount.");
  }
}
