import {
  DomainError,
  LocalDate,
  Money,
  Transaction,
  TransactionSplit,
  Transfer,
  type LedgerRepository,
  type TransactionKind,
  type TransactionStatus,
  type ExpenseExceptionality,
  type ExpenseVariability,
} from "@nexora/domain";

export interface CreateManualTransactionInput {
  readonly accountId: string;
  readonly amountMinor: bigint;
  readonly bookedDate: string;
  readonly categoryId?: string;
  readonly description: string;
  readonly kind: Exclude<TransactionKind, "transfer">;
  readonly payee: string;
  readonly status: Exclude<TransactionStatus, "cancelled" | "reconciled">;
  readonly tagIds?: readonly string[];
  readonly expenseVariability?: ExpenseVariability;
  readonly expenseExceptionality?: ExpenseExceptionality;
  readonly splits?: readonly {
    readonly categoryId: string;
    readonly amountMinor: bigint;
    readonly note?: string;
  }[];
}

export interface CreateTransferInput {
  readonly amountMinor: bigint;
  readonly bookedDate: string;
  readonly creditAccountId: string;
  readonly debitAccountId: string;
  readonly description: string;
  readonly status: Exclude<TransactionStatus, "cancelled" | "reconciled">;
}

export async function createManualTransaction(
  repository: LedgerRepository,
  input: CreateManualTransactionInput,
  idFactory: () => string = defaultTransactionId,
): Promise<Transaction> {
  const account = await requireAccount(repository, input.accountId);
  const categoryId = optional(input.categoryId);
  const description = optional(input.description);
  const payee = optional(input.payee);
  if (input.splits !== undefined && input.splits.length > 0 && categoryId !== undefined)
    throw new DomainError(
      "invalid_transaction",
      "Split transactions cannot have a direct category.",
    );
  const transaction = Transaction.create({
    id: idFactory(),
    kind: input.kind,
    status: input.status,
    accountId: account.id,
    amount: Money.fromMinor(input.amountMinor, account.currency),
    bookedDate: LocalDate.parse(input.bookedDate),
    source: "manual",
    ...(categoryId === undefined ? {} : { categoryId }),
    ...(description === undefined ? {} : { description }),
    ...(payee === undefined ? {} : { payee }),
    ...(input.expenseVariability === undefined
      ? {}
      : { expenseVariability: input.expenseVariability }),
    ...(input.expenseExceptionality === undefined
      ? {}
      : { expenseExceptionality: input.expenseExceptionality }),
  });
  const splits =
    input.splits?.map((split) =>
      TransactionSplit.create({
        id: idFactory(),
        transactionId: transaction.id,
        categoryId: split.categoryId,
        amount: Money.fromMinor(split.amountMinor, account.currency),
        ...(optional(split.note) === undefined ? {} : { note: optional(split.note)! }),
      }),
    ) ?? [];
  if (input.tagIds !== undefined && input.tagIds.length > 0)
    await repository.saveTransactionWithDetails(transaction, splits, input.tagIds);
  else if (splits.length === 0) await repository.saveTransaction(transaction);
  else await repository.saveTransactionWithSplits(transaction, splits);
  return transaction;
}

export async function createTransfer(
  repository: LedgerRepository,
  input: CreateTransferInput,
  idFactory: () => string = defaultTransactionId,
  transferIdFactory: () => string = defaultTransferId,
): Promise<Transfer> {
  const [debitAccount, creditAccount] = await Promise.all([
    requireAccount(repository, input.debitAccountId),
    requireAccount(repository, input.creditAccountId),
  ]);
  if (debitAccount.id === creditAccount.id) {
    throw new DomainError("invalid_transfer", "Transfer accounts must be different.");
  }
  if (debitAccount.currency !== creditAccount.currency) {
    throw new DomainError(
      "currency_mismatch",
      "Transfers currently require accounts with the same currency.",
    );
  }
  if (input.amountMinor <= 0n) {
    throw new DomainError("invalid_transaction", "Transfer amount must be positive.");
  }

  const bookedDate = LocalDate.parse(input.bookedDate);
  const description = optional(input.description);
  const debitTransaction = Transaction.create({
    id: idFactory(),
    kind: "transfer",
    status: input.status,
    accountId: debitAccount.id,
    amount: Money.fromMinor(-input.amountMinor, debitAccount.currency),
    bookedDate,
    source: "manual",
    ...(description === undefined ? {} : { description }),
  });
  const creditTransaction = Transaction.create({
    id: idFactory(),
    kind: "transfer",
    status: input.status,
    accountId: creditAccount.id,
    amount: Money.fromMinor(input.amountMinor, creditAccount.currency),
    bookedDate,
    source: "manual",
    ...(description === undefined ? {} : { description }),
  });
  const transfer = Transfer.create({
    id: transferIdFactory(),
    debitTransaction,
    creditTransaction,
  });
  await repository.saveTransfer({ transfer, debitTransaction, creditTransaction });
  return transfer;
}

export function signedAmountForKind(
  kind: Exclude<TransactionKind, "transfer">,
  amountMinor: bigint,
  adjustmentDirection: "increase" | "decrease" = "increase",
): bigint {
  if (amountMinor <= 0n) {
    throw new DomainError("invalid_transaction", "Transaction amount must be positive.");
  }
  if (kind === "expense") {
    return -amountMinor;
  }
  if (kind === "adjustment" && adjustmentDirection === "decrease") {
    return -amountMinor;
  }
  return amountMinor;
}

async function requireAccount(repository: LedgerRepository, id: string) {
  const account = await repository.findAccountById(id);
  if (account === undefined) {
    throw new DomainError("missing_reference", "Account does not exist.");
  }
  if (account.isArchived) {
    throw new DomainError("invalid_account", "Archived accounts cannot receive new transactions.");
  }
  return account;
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === "" || normalized === undefined ? undefined : normalized;
}

function defaultTransactionId(): string {
  return `transaction-${crypto.randomUUID()}`;
}

function defaultTransferId(): string {
  return `transfer-${crypto.randomUUID()}`;
}
