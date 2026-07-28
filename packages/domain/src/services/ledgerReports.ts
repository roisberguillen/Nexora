import type { Account } from "../entities/Account";
import type { Transaction } from "../entities/Transaction";
import { DomainError } from "../errors/DomainError";
import { Money } from "../value-objects/Money";

export interface CashFlowSummary {
  readonly income: Money;
  readonly expense: Money;
  readonly net: Money;
}

export function summarizeCashFlow(
  transactions: readonly Transaction[],
  currency: string,
): CashFlowSummary {
  let income = Money.zero(currency);
  let expense = Money.zero(currency);

  for (const transaction of transactions) {
    if (transaction.amount.currency !== income.currency || !transaction.affectsIncomeExpense()) {
      continue;
    }

    if (transaction.kind === "income") {
      income = income.add(transaction.amount);
    } else if (transaction.kind === "expense") {
      expense = expense.add(transaction.amount.negate());
    }
  }

  return Object.freeze({
    income,
    expense,
    net: income.subtract(expense),
  });
}

export function calculateAccountBalance(
  account: Account,
  transactions: readonly Transaction[],
): Money {
  let balance = account.openingBalance;

  for (const transaction of transactions) {
    if (transaction.accountId !== account.id || !transaction.affectsBalance()) {
      continue;
    }
    if (transaction.amount.currency !== account.currency) {
      throw new DomainError(
        "currency_mismatch",
        "Account transactions must use the account currency.",
      );
    }
    balance = balance.add(transaction.amount);
  }

  return balance;
}

export function calculateTotalBalance(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  currency: string,
): Money {
  let total = Money.zero(currency);

  for (const account of accounts) {
    if (account.currency === total.currency) {
      total = total.add(calculateAccountBalance(account, transactions));
    }
  }

  return total;
}
