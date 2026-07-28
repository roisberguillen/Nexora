import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";
import type { Transaction } from "./Transaction";

export interface CreateTransferProps {
  readonly id: string;
  readonly debitTransaction: Transaction;
  readonly creditTransaction: Transaction;
  readonly feeTransaction?: Transaction;
}

export class Transfer {
  public readonly id: string;
  public readonly debitTransactionId: string;
  public readonly creditTransactionId: string;
  public readonly feeTransactionId: string | undefined;

  private constructor(props: CreateTransferProps) {
    const { debitTransaction, creditTransaction, feeTransaction } = props;
    this.id = requireIdentifier(props.id, "Transfer id");
    this.debitTransactionId = debitTransaction.id;
    this.creditTransactionId = creditTransaction.id;
    this.feeTransactionId = feeTransaction?.id;

    if (debitTransaction.id === creditTransaction.id) {
      throw new DomainError("invalid_transfer", "Transfer legs must be distinct transactions.");
    }
    if (debitTransaction.kind !== "transfer" || creditTransaction.kind !== "transfer") {
      throw new DomainError("invalid_transfer", "Transfer legs must use the transfer kind.");
    }
    if (!debitTransaction.amount.isNegative() || !creditTransaction.amount.isPositive()) {
      throw new DomainError(
        "invalid_transfer",
        "A transfer requires a negative debit leg and a positive credit leg.",
      );
    }
    if (debitTransaction.accountId === creditTransaction.accountId) {
      throw new DomainError("invalid_transfer", "Transfer legs must use different accounts.");
    }
    if (debitTransaction.amount.currency !== creditTransaction.amount.currency) {
      throw new DomainError(
        "currency_mismatch",
        "Milestone 1 transfers require the same currency.",
      );
    }
    if (!debitTransaction.amount.add(creditTransaction.amount).isZero()) {
      throw new DomainError("invalid_transfer", "Transfer legs must have a net value of zero.");
    }
    if (!debitTransaction.bookedDate.equals(creditTransaction.bookedDate)) {
      throw new DomainError("invalid_transfer", "Transfer legs must use the same booked date.");
    }
    if (debitTransaction.status !== creditTransaction.status) {
      throw new DomainError("invalid_transfer", "Transfer legs must use the same status.");
    }

    if (feeTransaction !== undefined) {
      if (
        feeTransaction.id === debitTransaction.id ||
        feeTransaction.id === creditTransaction.id ||
        feeTransaction.kind !== "expense" ||
        feeTransaction.accountId !== debitTransaction.accountId ||
        feeTransaction.amount.currency !== debitTransaction.amount.currency ||
        !feeTransaction.bookedDate.equals(debitTransaction.bookedDate) ||
        feeTransaction.status !== debitTransaction.status
      ) {
        throw new DomainError(
          "invalid_transfer",
          "Transfer fees must be separate matching expenses on the debit account.",
        );
      }
    }

    Object.freeze(this);
  }

  public static create(props: CreateTransferProps): Transfer {
    return new Transfer(props);
  }
}
