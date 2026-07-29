import {
  Account,
  AllocationPlan,
  Budget,
  Category,
  ImportBatch,
  ImportRow,
  InvestmentPosition,
  LocalDate,
  Loan,
  MonthlyJournal,
  Money,
  Tag,
  Transaction,
  TransactionSplit,
  Transfer,
  RecurringRule,
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
  readonly recurringRules: readonly RecurringRule[];
  readonly allocationPlans: readonly AllocationPlan[];
  readonly budgets: readonly Budget[];
  readonly loans: readonly Loan[];
  readonly investmentPositions: readonly InvestmentPosition[];
  readonly monthlyJournals: readonly MonthlyJournal[];
  readonly importBatches: readonly ImportBatch[];
  readonly importRows: readonly ImportRow[];
  readonly transactionTagIds: ReadonlyMap<string, readonly string[]>;
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
  const recurringRules = entityList(entities, "recurringRules").map((value) =>
    RecurringRule.create({
      id: text(value, "id"),
      name: text(value, "name"),
      kind: text(value, "kind") as "income" | "expense",
      accountId: text(value, "accountId"),
      amount: money(value, "amount"),
      nominalDay: number(value, "nominalDay"),
      nextExpectedDate: LocalDate.parse(text(value, "nextExpectedDate")),
      frequency: text(value, "frequency") as "monthly",
      interval: number(value, "interval"),
      weekendPolicy: text(value, "weekendPolicy") as "none" | "salary_italy",
      enabled: boolean(value, "enabled"),
      ...(optionalText(value, "categoryId") === undefined
        ? {}
        : { categoryId: optionalText(value, "categoryId")! }),
      ...(optionalText(value, "payee") === undefined
        ? {}
        : { payee: optionalText(value, "payee")! }),
    }),
  );
  const allocationPlans = entityList(entities, "allocationPlans").map((value) =>
    AllocationPlan.create({
      id: text(value, "id"),
      name: text(value, "name"),
      trigger: text(value, "trigger") as "salary" | "photo_income",
      sourceAccountId: text(value, "sourceAccountId"),
      targetAccountId: text(value, "targetAccountId"),
      amount: money(value, "amount"),
      enabled: boolean(value, "enabled"),
    }),
  );
  const budgets = entityList(entities, "budgets").map((value) =>
    Budget.create({
      id: text(value, "id"),
      period: text(value, "period"),
      amount: money(value, "amount"),
      alertAt80: boolean(value, "alertAt80"),
      alertAt100: boolean(value, "alertAt100"),
      ...(optionalText(value, "categoryId") === undefined
        ? {}
        : { categoryId: optionalText(value, "categoryId")! }),
    }),
  );
  const loans = entityList(entities, "loans").map((value) =>
    Loan.create({
      id: text(value, "id"),
      accountId: text(value, "accountId"),
      lender: text(value, "lender"),
      installment: money(value, "installment"),
      remainingPrincipal: money(value, "remainingPrincipal"),
      ...(optionalObjectMoney(value, "originalPrincipal") === undefined
        ? {}
        : { originalPrincipal: optionalObjectMoney(value, "originalPrincipal")! }),
      ...(optionalNumber(value, "annualNominalRateBps") === undefined
        ? {}
        : { annualNominalRateBps: optionalNumber(value, "annualNominalRateBps")! }),
      ...(optionalNumber(value, "annualEffectiveRateBps") === undefined
        ? {}
        : { annualEffectiveRateBps: optionalNumber(value, "annualEffectiveRateBps")! }),
      ...(optionalNumber(value, "installmentsPaid") === undefined
        ? {}
        : { installmentsPaid: optionalNumber(value, "installmentsPaid")! }),
      ...(optionalNumber(value, "installmentsRemaining") === undefined
        ? {}
        : { installmentsRemaining: optionalNumber(value, "installmentsRemaining")! }),
      ...(optionalText(value, "nextDueDate") === undefined
        ? {}
        : { nextDueDate: LocalDate.parse(optionalText(value, "nextDueDate")!) }),
    }),
  );
  const investmentPositions = entityList(entities, "investmentPositions").map((value) =>
    InvestmentPosition.create({
      id: text(value, "id"),
      accountId: text(value, "accountId"),
      name: text(value, "name"),
      costBasis: money(value, "costBasis"),
      currentValue: money(value, "currentValue"),
      valuationDate: LocalDate.parse(text(value, "valuationDate")),
      ...(optionalText(value, "symbol") === undefined
        ? {}
        : { symbol: optionalText(value, "symbol")! }),
      ...(optionalText(value, "units") === undefined
        ? {}
        : { units: optionalText(value, "units")! }),
    }),
  );
  const monthlyJournals = entityList(entities, "monthlyJournals").map((value) =>
    MonthlyJournal.create({
      id: text(value, "id"),
      period: text(value, "period"),
      ...(optionalText(value, "note") === undefined ? {} : { note: optionalText(value, "note")! }),
      ...(optionalText(value, "nextMonthGoals") === undefined
        ? {}
        : { nextMonthGoals: optionalText(value, "nextMonthGoals")! }),
      ...(optionalNumber(value, "perceivedControl") === undefined
        ? {}
        : { perceivedControl: optionalNumber(value, "perceivedControl")! as 1 | 2 | 3 | 4 | 5 }),
    }),
  );
  const importBatches = entityList(entities, "importBatches").map((value) =>
    ImportBatch.create({
      id: text(value, "id"),
      importerType: text(value, "importerType") as
        "money_manager_xlsx" | "mediobanca_xlsx" | "n26_pdf",
      sourceFilename: text(value, "sourceFilename"),
      sourceSha256: text(value, "sourceSha256"),
      status: text(value, "status") as "previewed" | "committed" | "undone" | "failed",
      rowsTotal: number(value, "rowsTotal"),
      rowsImported: number(value, "rowsImported"),
      rowsSkipped: number(value, "rowsSkipped"),
      rowsFailed: number(value, "rowsFailed"),
    }),
  );
  const importRows = relationList(snapshot.relations, "importRows")
    .flatMap((relation) => recordArray(relation, "values"))
    .map((value) => {
      const normalizedJson = optionalText(value, "normalizedJson");
      const errorCode = optionalText(value, "errorCode");
      const createdTransactionId = optionalText(value, "createdTransactionId");
      const deletedTransactionId = optionalText(value, "deletedTransactionId");
      return ImportRow.create({
        id: text(value, "id"),
        batchId: text(value, "batchId"),
        rowNumber: number(value, "rowNumber"),
        rawJson: text(value, "rawJson"),
        status: text(value, "status") as
          "imported" | "skipped_duplicate" | "needs_review" | "failed",
        ...(normalizedJson === undefined ? {} : { normalizedJson }),
        ...(errorCode === undefined ? {} : { errorCode }),
        ...(createdTransactionId === undefined ? {} : { createdTransactionId }),
        ...(deletedTransactionId === undefined ? {} : { deletedTransactionId }),
      });
    });
  const transactionTagIds = new Map(
    relationList(snapshot.relations, "transactionTags").map((relation) => [
      text(relation, "id"),
      recordArray(relation, "values").map((tag) => text(tag, "id")),
    ]),
  );
  return Object.freeze({
    accounts,
    categories,
    tags,
    transactions,
    transfers,
    splits,
    recurringRules,
    allocationPlans,
    budgets,
    loans,
    investmentPositions,
    monthlyJournals,
    importBatches,
    importRows,
    transactionTagIds,
  });
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
function number(value: Record<string, unknown>, name: string): number {
  const candidate = value[name];
  if (typeof candidate !== "number" || !Number.isInteger(candidate))
    throw new Error(`Portable snapshot ${name} is invalid.`);
  return candidate;
}
function optionalNumber(value: Record<string, unknown>, name: string): number | undefined {
  const candidate = value[name];
  if (candidate === undefined || candidate === null) return undefined;
  return typeof candidate === "number" && Number.isInteger(candidate)
    ? candidate
    : (() => {
        throw new Error(`Portable snapshot ${name} is invalid.`);
      })();
}
function optionalObjectMoney(value: Record<string, unknown>, name: string): Money | undefined {
  const candidate = value[name];
  return candidate === undefined || candidate === null
    ? undefined
    : money({ [name]: candidate }, name);
}
function money(value: Record<string, unknown>, name: string): Money {
  const candidate = object(value[name]);
  return Money.fromMinor(BigInt(text(candidate, "amountMinor")), text(candidate, "currency"));
}
