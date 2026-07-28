import { describe, expect, it } from "vitest";

import { DomainError } from "../errors/DomainError";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Transaction } from "./Transaction";
import { Transfer } from "./Transfer";

const bookedDate = LocalDate.parse("2026-07-27");

function transferLeg(
  id: string,
  accountId: string,
  amountMinor: bigint,
  currency = "EUR",
): Transaction {
  return Transaction.create({
    id,
    kind: "transfer",
    status: "booked",
    accountId,
    amount: Money.fromMinor(amountMinor, currency),
    bookedDate,
  });
}

describe("Transfer", () => {
  it("collega esattamente due gambe con impatto netto zero", () => {
    const debit = transferLeg("transfer-debit", "account-a", -10_000n);
    const credit = transferLeg("transfer-credit", "account-b", 10_000n);
    const transfer = Transfer.create({
      id: "transfer-demo",
      debitTransaction: debit,
      creditTransaction: credit,
    });

    expect(transfer.debitTransactionId).toBe(debit.id);
    expect(transfer.creditTransactionId).toBe(credit.id);
    expect(debit.amount.add(credit.amount).isZero()).toBe(true);
  });

  it("rifiuta conti uguali, valori non bilanciati e valute diverse", () => {
    expect(() =>
      Transfer.create({
        id: "same-account",
        debitTransaction: transferLeg("debit-a", "account-a", -10_000n),
        creditTransaction: transferLeg("credit-a", "account-a", 10_000n),
      }),
    ).toThrowError(DomainError);

    expect(() =>
      Transfer.create({
        id: "unbalanced",
        debitTransaction: transferLeg("debit-b", "account-a", -10_000n),
        creditTransaction: transferLeg("credit-b", "account-b", 9_999n),
      }),
    ).toThrowError(DomainError);

    expect(() =>
      Transfer.create({
        id: "cross-currency",
        debitTransaction: transferLeg("debit-c", "account-a", -10_000n, "EUR"),
        creditTransaction: transferLeg("credit-c", "account-b", 10_000n, "USD"),
      }),
    ).toThrowError(DomainError);
  });

  it("rappresenta la fee come spesa separata sul conto di addebito", () => {
    const debit = transferLeg("debit-fee", "account-a", -10_000n);
    const credit = transferLeg("credit-fee", "account-b", 10_000n);
    const fee = Transaction.create({
      id: "fee-demo",
      kind: "expense",
      status: "booked",
      accountId: "account-a",
      amount: Money.fromMinor(-250n, "EUR"),
      bookedDate,
    });

    expect(
      Transfer.create({
        id: "transfer-with-fee",
        debitTransaction: debit,
        creditTransaction: credit,
        feeTransaction: fee,
      }).feeTransactionId,
    ).toBe("fee-demo");
  });
});
