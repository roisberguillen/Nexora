import {
  Account,
  Category,
  LocalDate,
  Money,
  Tag,
  Transaction,
  TransactionSplit,
  Transfer,
  type LedgerRepository,
} from "@nexora/domain";

export const PORTABLE_LEDGER_SNAPSHOT_VERSION = 1;

export interface PortableLedgerSnapshot {
  readonly formatVersion: typeof PORTABLE_LEDGER_SNAPSHOT_VERSION;
  readonly entities: Readonly<Record<string, readonly unknown[]>>;
  readonly relations: Readonly<Record<string, readonly unknown[]>>;
}
export interface ValidatedPortableLedgerSnapshot {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly tags: readonly Tag[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly Transfer[];
  readonly splits: readonly TransactionSplit[];
}

export async function capturePortableLedgerSnapshot(
  repository: LedgerRepository,
): Promise<PortableLedgerSnapshot> {
  const [
    accounts,
    categories,
    tags,
    transactions,
    transfers,
    importBatches,
    recurringRules,
    allocationPlans,
    budgets,
    loans,
    investmentPositions,
    monthlyJournals,
  ] = await Promise.all([
    repository.listAccounts(),
    repository.listCategories(),
    repository.listTags(),
    repository.listTransactions(),
    repository.listTransfers(),
    repository.listImportBatches(),
    repository.listRecurringRules(),
    repository.listAllocationPlans(),
    repository.listBudgets(),
    repository.listLoans(),
    repository.listInvestmentPositions(),
    repository.listMonthlyJournals(),
  ]);
  const [splits, transactionTags, importRows] = await Promise.all([
    Promise.all(
      transactions.map(async (transaction) => ({
        id: transaction.id,
        values: await repository.listTransactionSplits(transaction.id),
      })),
    ),
    Promise.all(
      transactions.map(async (transaction) => ({
        id: transaction.id,
        values: await repository.listTransactionTags(transaction.id),
      })),
    ),
    Promise.all(
      importBatches.map(async (batch) => ({
        id: batch.id,
        values: await repository.listImportRows(batch.id),
      })),
    ),
  ]);
  return Object.freeze({
    formatVersion: PORTABLE_LEDGER_SNAPSHOT_VERSION,
    entities: Object.freeze({
      accounts,
      categories,
      tags,
      transactions,
      transfers,
      importBatches,
      recurringRules,
      allocationPlans,
      budgets,
      loans,
      investmentPositions,
      monthlyJournals,
    }),
    relations: Object.freeze({ splits, transactionTags, importRows }),
  });
}

export function encodePortableLedgerSnapshot(snapshot: PortableLedgerSnapshot): Uint8Array {
  if (snapshot.formatVersion !== PORTABLE_LEDGER_SNAPSHOT_VERSION)
    throw new Error("Unsupported portable ledger snapshot.");
  return new TextEncoder().encode(
    JSON.stringify(snapshot, (_key, value: unknown) =>
      typeof value === "bigint" ? { $nexoraBigInt: value.toString() } : value,
    ),
  );
}

export function decodePortableLedgerSnapshot(bytes: Uint8Array): PortableLedgerSnapshot {
  const parsed: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    (_key, value: unknown) => {
      if (value && typeof value === "object" && "$nexoraBigInt" in value) {
        const encoded = (value as { readonly $nexoraBigInt: unknown }).$nexoraBigInt;
        if (typeof encoded !== "string" || !/^-?\d+$/.test(encoded))
          throw new Error("Invalid bigint in snapshot.");
        return BigInt(encoded);
      }
      return value;
    },
  );
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { formatVersion?: unknown }).formatVersion !== PORTABLE_LEDGER_SNAPSHOT_VERSION
  )
    throw new Error("Invalid portable ledger snapshot.");
  const snapshot = parsed as PortableLedgerSnapshot;
  if (
    !snapshot.entities ||
    !snapshot.relations ||
    typeof snapshot.entities !== "object" ||
    typeof snapshot.relations !== "object"
  )
    throw new Error("Invalid portable ledger snapshot structure.");
  return snapshot;
}

export function validatePortableLedgerSnapshot(
  snapshot: PortableLedgerSnapshot,
): ValidatedPortableLedgerSnapshot {
  for (const name of [
    "accounts",
    "categories",
    "tags",
    "transactions",
    "transfers",
    "importBatches",
    "recurringRules",
    "allocationPlans",
    "budgets",
    "loans",
    "investmentPositions",
    "monthlyJournals",
  ])
    entityList(snapshot.entities, name);
  for (const name of ["splits", "transactionTags", "importRows"])
    relationList(snapshot.relations, name);
  const entities = snapshot.entities;
  const accounts = entityList(entities, "accounts").map(createAccount);
  const categories = entityList(entities, "categories").map(createCategory);
  const tags = entityList(entities, "tags").map((value) =>
    Tag.create({
      id: text(value, "id"),
      name: text(value, "name"),
      isArchived: boolean(value, "isArchived"),
    }),
  );
  const transactions = entityList(entities, "transactions").map(createTransaction);
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const splits = relationList(snapshot.relations, "splits")
    .flatMap((relation) => recordArray(relation, "values"))
    .map(createSplit);
  const transfers = entityList(entities, "transfers").map((value) => {
    const debit = transactionById.get(text(value, "debitTransactionId"));
    const credit = transactionById.get(text(value, "creditTransactionId"));
    const feeId = optionalText(value, "feeTransactionId");
    const fee = feeId === undefined ? undefined : transactionById.get(feeId);
    if (!debit || !credit || (feeId !== undefined && !fee))
      throw new Error("Portable snapshot transfer leg is missing.");
    return Transfer.create({
      id: text(value, "id"),
      debitTransaction: debit,
      creditTransaction: credit,
      ...(fee === undefined ? {} : { feeTransaction: fee }),
    });
  });
  return Object.freeze({ accounts, categories, tags, transactions, transfers, splits });
}

function createAccount(value: Record<string, unknown>): Account {
  const institution = optionalText(value, "institution");
  const parentAccountId = optionalText(value, "parentAccountId");
  return Account.create({
    id: text(value, "id"),
    name: text(value, "name"),
    type: text(value, "type") as Account["type"],
    currency: text(value, "currency"),
    openingBalance: money(value, "openingBalance"),
    ...(institution === undefined ? {} : { institution }),
    ...(parentAccountId === undefined ? {} : { parentAccountId }),
    isArchived: boolean(value, "isArchived"),
  });
}
function createCategory(value: Record<string, unknown>): Category {
  const parentId = optionalText(value, "parentId");
  return Category.create({
    id: text(value, "id"),
    name: text(value, "name"),
    kindScope: text(value, "kindScope") as Category["kindScope"],
    ...(parentId === undefined ? {} : { parentId }),
    isArchived: boolean(value, "isArchived"),
  });
}
function createTransaction(value: Record<string, unknown>): Transaction {
  const valueDate = optionalText(value, "valueDate");
  const payee = optionalText(value, "payee");
  const description = optionalText(value, "description");
  const categoryId = optionalText(value, "categoryId");
  const note = optionalText(value, "note");
  const importBatchId = optionalText(value, "importBatchId");
  const sourceFingerprint = optionalText(value, "sourceFingerprint");
  return Transaction.create({
    id: text(value, "id"),
    kind: text(value, "kind") as Transaction["kind"],
    status: text(value, "status") as Transaction["status"],
    accountId: text(value, "accountId"),
    amount: money(value, "amount"),
    bookedDate: LocalDate.parse(text(value, "bookedDate")),
    source: text(value, "source") as Transaction["source"],
    ...(valueDate === undefined ? {} : { valueDate: LocalDate.parse(valueDate) }),
    ...(payee === undefined ? {} : { payee }),
    ...(description === undefined ? {} : { description }),
    ...(categoryId === undefined ? {} : { categoryId }),
    ...(note === undefined ? {} : { note }),
    ...(importBatchId === undefined ? {} : { importBatchId }),
    ...(sourceFingerprint === undefined ? {} : { sourceFingerprint }),
  });
}
function createSplit(value: Record<string, unknown>): TransactionSplit {
  const note = optionalText(value, "note");
  return TransactionSplit.create({
    id: text(value, "id"),
    transactionId: text(value, "transactionId"),
    categoryId: text(value, "categoryId"),
    amount: money(value, "amount"),
    ...(note === undefined ? {} : { note }),
  });
}

function entityList(
  source: Readonly<Record<string, readonly unknown[]>>,
  name: string,
): readonly Record<string, unknown>[] {
  const value = source[name];
  if (!Array.isArray(value)) throw new Error(`Portable snapshot ${name} is missing.`);
  return value.map(object);
}
function relationList(
  source: Readonly<Record<string, readonly unknown[]>>,
  name: string,
): readonly Record<string, unknown>[] {
  const value = source[name];
  if (!Array.isArray(value)) throw new Error(`Portable snapshot relation ${name} is missing.`);
  return value.map(object);
}
function recordArray(
  source: Record<string, unknown>,
  name: string,
): readonly Record<string, unknown>[] {
  const value = source[name];
  if (!Array.isArray(value)) throw new Error(`Portable snapshot relation ${name} is missing.`);
  return value.map(object);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Portable snapshot entity is invalid.");
  return value as Record<string, unknown>;
}
function text(value: Record<string, unknown>, name: string): string {
  const candidate = value[name];
  if (typeof candidate !== "string") throw new Error(`Portable snapshot ${name} is invalid.`);
  return candidate;
}
function optionalText(value: Record<string, unknown>, name: string): string | undefined {
  const candidate = value[name];
  if (candidate === undefined || candidate === null) return undefined;
  return typeof candidate === "string"
    ? candidate
    : (() => {
        throw new Error(`Portable snapshot ${name} is invalid.`);
      })();
}
function boolean(value: Record<string, unknown>, name: string): boolean {
  const candidate = value[name];
  if (typeof candidate !== "boolean") throw new Error(`Portable snapshot ${name} is invalid.`);
  return candidate;
}
function money(value: Record<string, unknown>, name: string): Money {
  const candidate = object(value[name]);
  return Money.fromMinor(BigInt(text(candidate, "amountMinor")), text(candidate, "currency"));
}
