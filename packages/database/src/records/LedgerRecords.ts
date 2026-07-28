import {
  Account,
  type AccountType,
  Category,
  type CategoryKindScope,
  LocalDate,
  Money,
  Transaction,
  type TransactionKind,
  type TransactionSource,
  type TransactionStatus,
  Transfer,
  TransactionSplit,
  Tag,
} from "@nexora/domain";

import { PersistenceError } from "../sqlite/PersistenceError";

export interface AccountRecord {
  readonly id: unknown;
  readonly name: unknown;
  readonly type: unknown;
  readonly institution: unknown;
  readonly currency: unknown;
  readonly parent_account_id: unknown;
  readonly opening_balance_minor: unknown;
  readonly is_archived: unknown;
}

export interface StoredAccountRecord extends AccountRecord {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
  readonly institution: string | null;
  readonly currency: string;
  readonly parent_account_id: string | null;
  readonly opening_balance_minor: string;
  readonly is_archived: 0 | 1;
}

export interface CategoryRecord {
  readonly id: unknown;
  readonly name: unknown;
  readonly kind_scope: unknown;
  readonly parent_id: unknown;
  readonly is_archived: unknown;
}

export interface StoredCategoryRecord extends CategoryRecord {
  readonly id: string;
  readonly name: string;
  readonly kind_scope: CategoryKindScope;
  readonly parent_id: string | null;
  readonly is_archived: 0 | 1;
}

export interface TransactionRecord {
  readonly id: unknown;
  readonly kind: unknown;
  readonly status: unknown;
  readonly account_id: unknown;
  readonly amount_minor: unknown;
  readonly currency: unknown;
  readonly booked_date: unknown;
  readonly value_date: unknown;
  readonly payee: unknown;
  readonly description: unknown;
  readonly category_id: unknown;
  readonly note: unknown;
  readonly source: unknown;
  readonly import_batch_id?: unknown;
  readonly source_fingerprint?: unknown;
}

export interface StoredTransactionRecord extends TransactionRecord {
  readonly id: string;
  readonly kind: TransactionKind;
  readonly status: TransactionStatus;
  readonly account_id: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly booked_date: string;
  readonly value_date: string | null;
  readonly payee: string | null;
  readonly description: string | null;
  readonly category_id: string | null;
  readonly note: string | null;
  readonly source: TransactionSource;
  readonly import_batch_id: string | null;
  readonly source_fingerprint: string | null;
}

export interface TransferRecord {
  readonly id: unknown;
  readonly debit_transaction_id: unknown;
  readonly credit_transaction_id: unknown;
  readonly fee_transaction_id: unknown;
}

export interface StoredTransferRecord extends TransferRecord {
  readonly id: string;
  readonly debit_transaction_id: string;
  readonly credit_transaction_id: string;
  readonly fee_transaction_id: string | null;
}

export interface TransactionSplitRecord {
  readonly id: unknown;
  readonly transaction_id: unknown;
  readonly category_id: unknown;
  readonly amount_minor: unknown;
  readonly currency: unknown;
  readonly note: unknown;
}

export interface TagRecord {
  readonly id: unknown;
  readonly name: unknown;
  readonly is_archived: unknown;
}
export interface StoredTagRecord extends TagRecord {
  readonly id: string;
  readonly name: string;
  readonly is_archived: 0 | 1;
}

export interface StoredTransactionSplitRecord extends TransactionSplitRecord {
  readonly id: string;
  readonly transaction_id: string;
  readonly category_id: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly note: string | null;
}

const accountTypes: readonly AccountType[] = [
  "checking",
  "savings",
  "cash",
  "investment",
  "loan",
  "virtual_subaccount",
];
const categoryScopes: readonly CategoryKindScope[] = ["income", "expense", "both"];
const transactionKinds: readonly TransactionKind[] = [
  "income",
  "expense",
  "transfer",
  "adjustment",
];
const transactionStatuses: readonly TransactionStatus[] = [
  "expected",
  "booked",
  "reconciled",
  "cancelled",
];
const transactionSources: readonly TransactionSource[] = [
  "manual",
  "import",
  "recurring",
  "system",
];

export function accountToRecord(account: Account): StoredAccountRecord {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    institution: account.institution ?? null,
    currency: account.currency,
    parent_account_id: account.parentAccountId ?? null,
    opening_balance_minor: account.openingBalance.amountMinor.toString(),
    is_archived: account.isArchived ? 1 : 0,
  };
}

export function accountFromRecord(row: AccountRecord): Account {
  try {
    const institution = optionalText(row.institution, "account.institution");
    const parentAccountId = optionalText(row.parent_account_id, "account.parent_account_id");
    const currency = requiredText(row.currency, "account.currency");
    return Account.create({
      id: requiredText(row.id, "account.id"),
      name: requiredText(row.name, "account.name"),
      type: enumValue(row.type, accountTypes, "account.type"),
      currency,
      openingBalance: Money.fromMinor(
        BigInt(requiredText(row.opening_balance_minor, "account.opening_balance_minor")),
        currency,
      ),
      isArchived: storedBoolean(row.is_archived, "account.is_archived"),
      ...(institution === undefined ? {} : { institution }),
      ...(parentAccountId === undefined ? {} : { parentAccountId }),
    });
  } catch (cause) {
    throw corruptRecord("account", cause);
  }
}

export function categoryToRecord(category: Category): StoredCategoryRecord {
  return {
    id: category.id,
    name: category.name,
    kind_scope: category.kindScope,
    parent_id: category.parentId ?? null,
    is_archived: category.isArchived ? 1 : 0,
  };
}

export function categoryFromRecord(row: CategoryRecord): Category {
  try {
    const parentId = optionalText(row.parent_id, "category.parent_id");
    return Category.create({
      id: requiredText(row.id, "category.id"),
      name: requiredText(row.name, "category.name"),
      kindScope: enumValue(row.kind_scope, categoryScopes, "category.kind_scope"),
      isArchived: storedBoolean(row.is_archived, "category.is_archived"),
      ...(parentId === undefined ? {} : { parentId }),
    });
  } catch (cause) {
    throw corruptRecord("category", cause);
  }
}

export function tagToRecord(tag: Tag): StoredTagRecord {
  return { id: tag.id, name: tag.name, is_archived: tag.isArchived ? 1 : 0 };
}
export function tagFromRecord(row: TagRecord): Tag {
  try {
    return Tag.create({
      id: requiredText(row.id, "tag.id"),
      name: requiredText(row.name, "tag.name"),
      isArchived: storedBoolean(row.is_archived, "tag.is_archived"),
    });
  } catch (cause) {
    throw corruptRecord("tag", cause);
  }
}

export function transactionToRecord(transaction: Transaction): StoredTransactionRecord {
  return {
    id: transaction.id,
    kind: transaction.kind,
    status: transaction.status,
    account_id: transaction.accountId,
    amount_minor: transaction.amount.amountMinor.toString(),
    currency: transaction.amount.currency,
    booked_date: transaction.bookedDate.toString(),
    value_date: transaction.valueDate?.toString() ?? null,
    payee: transaction.payee ?? null,
    description: transaction.description ?? null,
    category_id: transaction.categoryId ?? null,
    note: transaction.note ?? null,
    source: transaction.source,
    import_batch_id: transaction.importBatchId ?? null,
    source_fingerprint: transaction.sourceFingerprint ?? null,
  };
}

export function transactionFromRecord(row: TransactionRecord): Transaction {
  try {
    const currency = requiredText(row.currency, "transaction.currency");
    const valueDate = optionalText(row.value_date, "transaction.value_date");
    const payee = optionalText(row.payee, "transaction.payee");
    const description = optionalText(row.description, "transaction.description");
    const categoryId = optionalText(row.category_id, "transaction.category_id");
    const note = optionalText(row.note, "transaction.note");
    const importBatchId = optionalText(row.import_batch_id ?? null, "transaction.import_batch_id");
    const sourceFingerprint = optionalText(
      row.source_fingerprint ?? null,
      "transaction.source_fingerprint",
    );

    return Transaction.create({
      id: requiredText(row.id, "transaction.id"),
      kind: enumValue(row.kind, transactionKinds, "transaction.kind"),
      status: enumValue(row.status, transactionStatuses, "transaction.status"),
      accountId: requiredText(row.account_id, "transaction.account_id"),
      amount: Money.fromMinor(
        BigInt(requiredText(row.amount_minor, "transaction.amount_minor")),
        currency,
      ),
      bookedDate: LocalDate.parse(requiredText(row.booked_date, "transaction.booked_date")),
      source: enumValue(row.source, transactionSources, "transaction.source"),
      ...(valueDate === undefined ? {} : { valueDate: LocalDate.parse(valueDate) }),
      ...(payee === undefined ? {} : { payee }),
      ...(description === undefined ? {} : { description }),
      ...(categoryId === undefined ? {} : { categoryId }),
      ...(note === undefined ? {} : { note }),
      ...(importBatchId === undefined ? {} : { importBatchId }),
      ...(sourceFingerprint === undefined ? {} : { sourceFingerprint }),
    });
  } catch (cause) {
    throw corruptRecord("transaction", cause);
  }
}

export function transferToRecord(transfer: Transfer): StoredTransferRecord {
  return {
    id: transfer.id,
    debit_transaction_id: transfer.debitTransactionId,
    credit_transaction_id: transfer.creditTransactionId,
    fee_transaction_id: transfer.feeTransactionId ?? null,
  };
}

export function transactionSplitToRecord(split: TransactionSplit): StoredTransactionSplitRecord {
  return {
    id: split.id,
    transaction_id: split.transactionId,
    category_id: split.categoryId,
    amount_minor: split.amount.amountMinor.toString(),
    currency: split.amount.currency,
    note: split.note ?? null,
  };
}

export function transactionSplitFromRecord(row: TransactionSplitRecord): TransactionSplit {
  try {
    const currency = requiredText(row.currency, "transaction_split.currency");
    const note = optionalText(row.note, "transaction_split.note");
    return TransactionSplit.create({
      id: requiredText(row.id, "transaction_split.id"),
      transactionId: requiredText(row.transaction_id, "transaction_split.transaction_id"),
      categoryId: requiredText(row.category_id, "transaction_split.category_id"),
      amount: Money.fromMinor(
        BigInt(requiredText(row.amount_minor, "transaction_split.amount_minor")),
        currency,
      ),
      ...(note === undefined ? {} : { note }),
    });
  } catch (cause) {
    throw corruptRecord("transaction split", cause);
  }
}

export function transferFromRecord(
  row: TransferRecord,
  transactions: ReadonlyMap<string, Transaction>,
): Transfer {
  try {
    const debitTransactionId = requiredText(
      row.debit_transaction_id,
      "transfer.debit_transaction_id",
    );
    const creditTransactionId = requiredText(
      row.credit_transaction_id,
      "transfer.credit_transaction_id",
    );
    const feeTransactionId = optionalText(row.fee_transaction_id, "transfer.fee_transaction_id");
    const debitTransaction = transactions.get(debitTransactionId);
    const creditTransaction = transactions.get(creditTransactionId);
    const feeTransaction =
      feeTransactionId === undefined ? undefined : transactions.get(feeTransactionId);

    if (
      debitTransaction === undefined ||
      creditTransaction === undefined ||
      (feeTransactionId !== undefined && feeTransaction === undefined)
    ) {
      throw new Error("Transfer leg is missing.");
    }

    return Transfer.create({
      id: requiredText(row.id, "transfer.id"),
      debitTransaction,
      creditTransaction,
      ...(feeTransaction === undefined ? {} : { feeTransaction }),
    });
  } catch (cause) {
    throw corruptRecord("transfer", cause);
  }
}

export function transactionRecordMap(
  rows: readonly TransactionRecord[],
): ReadonlyMap<string, Transaction> {
  const transactions = new Map<string, Transaction>();
  for (const row of rows) {
    const transaction = transactionFromRecord(row);
    transactions.set(transaction.id, transaction);
  }
  return transactions;
}

export function transferRecordTransactionIds(row: TransferRecord): readonly string[] {
  const debitId = requiredText(row.debit_transaction_id, "transfer.debit_transaction_id");
  const creditId = requiredText(row.credit_transaction_id, "transfer.credit_transaction_id");
  const feeId = optionalText(row.fee_transaction_id, "transfer.fee_transaction_id");
  return feeId === undefined ? [debitId, creditId] : [debitId, creditId, feeId];
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === null) {
    return undefined;
  }
  return requiredText(value, field);
}

function storedBoolean(value: unknown, field: string): boolean {
  if (value === 0) {
    return false;
  }
  if (value === 1) {
    return true;
  }
  throw new Error(`${field} must be a persisted boolean.`);
}

function enumValue<Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  field: string,
): Value {
  const text = requiredText(value, field);
  if (!allowed.includes(text as Value)) {
    throw new Error(`${field} contains an unsupported value.`);
  }
  return text as Value;
}

function corruptRecord(entity: string, cause: unknown): PersistenceError {
  if (cause instanceof PersistenceError) {
    return cause;
  }
  return new PersistenceError(
    "corrupt_record",
    `The persisted ${entity} record is invalid.`,
    cause,
  );
}
