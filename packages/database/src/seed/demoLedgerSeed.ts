import {
  Account,
  Category,
  type LedgerRepository,
  LocalDate,
  Money,
  Transaction,
  Transfer,
  type TransferBundle,
} from "@nexora/domain";

import { DemoSeedError } from "./DemoSeedError";

export const DEMO_LEDGER_SEED_VERSION = 1;

export interface DemoLedgerSeed {
  readonly version: typeof DEMO_LEDGER_SEED_VERSION;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly TransferBundle[];
}

export type DemoSeedStatus = "created" | "repaired" | "already_present";

export interface DemoSeedEntityCounts {
  readonly accounts: number;
  readonly categories: number;
  readonly transactions: number;
  readonly transfers: number;
}

export interface DemoSeedResult {
  readonly version: typeof DEMO_LEDGER_SEED_VERSION;
  readonly status: DemoSeedStatus;
  readonly inserted: DemoSeedEntityCounts;
}

interface ExistingLedger {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly Transfer[];
}

interface ExpectedLedger {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly standaloneTransactions: readonly Transaction[];
  readonly transferBundles: readonly TransferBundle[];
  readonly transactions: readonly Transaction[];
  readonly transfers: readonly Transfer[];
}

const seedQueues = new WeakMap<LedgerRepository, Promise<void>>();

export function createDemoLedgerSeed(): DemoLedgerSeed {
  const primaryAccount = Account.create({
    id: "demo-account-primary",
    name: "Conto quotidiano demo",
    type: "checking",
    institution: "Banca campione",
    currency: "EUR",
    openingBalance: Money.fromMinor(235_000n, "EUR"),
  });
  const reserveAccount = Account.create({
    id: "demo-account-reserve",
    name: "Riserva demo",
    type: "savings",
    institution: "Banca campione",
    currency: "EUR",
    openingBalance: Money.fromMinor(120_000n, "EUR"),
  });
  const goalAccount = Account.create({
    id: "demo-account-goal",
    name: "Obiettivo demo",
    type: "virtual_subaccount",
    currency: "EUR",
    parentAccountId: reserveAccount.id,
  });
  const cashAccount = Account.create({
    id: "demo-account-cash",
    name: "Portafoglio demo",
    type: "cash",
    currency: "EUR",
    openingBalance: Money.fromMinor(8_000n, "EUR"),
  });

  const incomeCategory = Category.create({
    id: "demo-category-income",
    name: "Compensi demo",
    kindScope: "income",
  });
  const expensesCategory = Category.create({
    id: "demo-category-expenses",
    name: "Spese demo",
    kindScope: "expense",
  });
  const housingCategory = Category.create({
    id: "demo-category-housing",
    name: "Casa demo",
    kindScope: "expense",
    parentId: expensesCategory.id,
  });
  const groceriesCategory = Category.create({
    id: "demo-category-groceries",
    name: "Spesa quotidiana demo",
    kindScope: "expense",
    parentId: expensesCategory.id,
  });
  const leisureCategory = Category.create({
    id: "demo-category-leisure",
    name: "Tempo libero demo",
    kindScope: "expense",
    parentId: expensesCategory.id,
  });

  const transactions = [
    Transaction.create({
      id: "demo-transaction-income",
      kind: "income",
      status: "booked",
      accountId: primaryAccount.id,
      amount: Money.fromMinor(240_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-01"),
      payee: "Datore campione",
      description: "Compenso mensile dimostrativo",
      categoryId: incomeCategory.id,
    }),
    Transaction.create({
      id: "demo-transaction-housing",
      kind: "expense",
      status: "booked",
      accountId: primaryAccount.id,
      amount: Money.fromMinor(-78_000n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-02"),
      payee: "Locatore campione",
      categoryId: housingCategory.id,
    }),
    Transaction.create({
      id: "demo-transaction-groceries",
      kind: "expense",
      status: "reconciled",
      accountId: primaryAccount.id,
      amount: Money.fromMinor(-6_540n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-05"),
      payee: "Negozio campione",
      categoryId: groceriesCategory.id,
    }),
    Transaction.create({
      id: "demo-transaction-leisure",
      kind: "expense",
      status: "booked",
      accountId: primaryAccount.id,
      amount: Money.fromMinor(-3_250n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-08"),
      payee: "Cinema campione",
      categoryId: leisureCategory.id,
    }),
    Transaction.create({
      id: "demo-transaction-cash",
      kind: "expense",
      status: "booked",
      accountId: cashAccount.id,
      amount: Money.fromMinor(-1_850n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-10"),
      payee: "Esercente campione",
      categoryId: groceriesCategory.id,
    }),
    Transaction.create({
      id: "demo-transaction-cancelled",
      kind: "expense",
      status: "cancelled",
      accountId: primaryAccount.id,
      amount: Money.fromMinor(-9_900n, "EUR"),
      bookedDate: LocalDate.parse("2026-07-12"),
      payee: "Servizio campione",
      categoryId: leisureCategory.id,
      note: "Operazione annullata dimostrativa",
    }),
  ] as const;

  const debitTransaction = Transaction.create({
    id: "demo-transfer-debit",
    kind: "transfer",
    status: "booked",
    accountId: primaryAccount.id,
    amount: Money.fromMinor(-12_500n, "EUR"),
    bookedDate: LocalDate.parse("2026-07-15"),
    description: "Trasferimento interno dimostrativo",
  });
  const creditTransaction = Transaction.create({
    id: "demo-transfer-credit",
    kind: "transfer",
    status: "booked",
    accountId: reserveAccount.id,
    amount: Money.fromMinor(12_500n, "EUR"),
    bookedDate: LocalDate.parse("2026-07-15"),
    description: "Trasferimento interno dimostrativo",
  });
  const transfer = Transfer.create({
    id: "demo-transfer",
    debitTransaction,
    creditTransaction,
  });

  return Object.freeze({
    version: DEMO_LEDGER_SEED_VERSION,
    accounts: Object.freeze([primaryAccount, reserveAccount, goalAccount, cashAccount]),
    categories: Object.freeze([
      incomeCategory,
      expensesCategory,
      housingCategory,
      groceriesCategory,
      leisureCategory,
    ]),
    transactions: Object.freeze([...transactions]),
    transfers: Object.freeze([
      Object.freeze({
        transfer,
        debitTransaction,
        creditTransaction,
      }),
    ]),
  });
}

export function seedDemoLedger(repository: LedgerRepository): Promise<DemoSeedResult> {
  const previous = seedQueues.get(repository) ?? Promise.resolve();
  const result = previous.then(
    () => seedDemoLedgerInternal(repository),
    () => seedDemoLedgerInternal(repository),
  );
  seedQueues.set(
    repository,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}

async function seedDemoLedgerInternal(repository: LedgerRepository): Promise<DemoSeedResult> {
  const seed = createDemoLedgerSeed();
  const expected = expectedLedger(seed);
  const existing = await readLedger(repository);
  const presentCount = validateExistingLedger(existing, expected);
  const expectedCount =
    expected.accounts.length +
    expected.categories.length +
    expected.transactions.length +
    expected.transfers.length;

  if (presentCount === expectedCount) {
    return result("already_present", emptyCounts());
  }
  if (hasUnexpectedEntities(existing, expected)) {
    throw new DemoSeedError(
      "non_empty_ledger",
      "Demo data can only be added to an empty ledger or a matching partial demo seed.",
    );
  }

  const inserted = {
    accounts: 0,
    categories: 0,
    transactions: 0,
    transfers: 0,
  };
  const existingAccountIds = ids(existing.accounts);
  const existingCategoryIds = ids(existing.categories);
  const existingTransactionIds = ids(existing.transactions);
  const existingTransferIds = ids(existing.transfers);

  for (const account of expected.accounts) {
    if (!existingAccountIds.has(account.id)) {
      await repository.saveAccount(account);
      inserted.accounts += 1;
    }
  }
  for (const category of expected.categories) {
    if (!existingCategoryIds.has(category.id)) {
      await repository.saveCategory(category);
      inserted.categories += 1;
    }
  }
  for (const transaction of expected.standaloneTransactions) {
    if (!existingTransactionIds.has(transaction.id)) {
      await repository.saveTransaction(transaction);
      inserted.transactions += 1;
    }
  }
  for (const bundle of expected.transferBundles) {
    if (existingTransferIds.has(bundle.transfer.id)) {
      continue;
    }
    const bundleTransactionIds = [
      bundle.debitTransaction.id,
      bundle.creditTransaction.id,
      ...(bundle.feeTransaction === undefined ? [] : [bundle.feeTransaction.id]),
    ];
    if (bundleTransactionIds.some((id) => existingTransactionIds.has(id))) {
      throw new DemoSeedError(
        "seed_conflict",
        "A partial demo transfer cannot be repaired safely.",
      );
    }

    await repository.saveTransfer(bundle);
    inserted.transactions += bundleTransactionIds.length;
    inserted.transfers += 1;
  }

  return result(presentCount === 0 ? "created" : "repaired", inserted);
}

function expectedLedger(seed: DemoLedgerSeed): ExpectedLedger {
  const transferTransactions = seed.transfers.flatMap((bundle) => [
    bundle.debitTransaction,
    bundle.creditTransaction,
    ...(bundle.feeTransaction === undefined ? [] : [bundle.feeTransaction]),
  ]);
  return {
    accounts: seed.accounts,
    categories: seed.categories,
    standaloneTransactions: seed.transactions,
    transferBundles: seed.transfers,
    transactions: [...seed.transactions, ...transferTransactions],
    transfers: seed.transfers.map((bundle) => bundle.transfer),
  };
}

async function readLedger(repository: LedgerRepository): Promise<ExistingLedger> {
  const [accounts, categories, transactions, transfers] = await Promise.all([
    repository.listAccounts(),
    repository.listCategories(),
    repository.listTransactions(),
    repository.listTransfers(),
  ]);
  return { accounts, categories, transactions, transfers };
}

function validateExistingLedger(existing: ExistingLedger, expected: ExpectedLedger): number {
  return (
    validateEntities(existing.accounts, expected.accounts, "account", sameAccount) +
    validateEntities(existing.categories, expected.categories, "category", sameCategory) +
    validateEntities(existing.transactions, expected.transactions, "transaction", sameTransaction) +
    validateEntities(existing.transfers, expected.transfers, "transfer", sameTransfer)
  );
}

function validateEntities<Entity extends { readonly id: string }>(
  existing: readonly Entity[],
  expected: readonly Entity[],
  label: string,
  equivalent: (left: Entity, right: Entity) => boolean,
): number {
  const existingById = new Map(existing.map((entity) => [entity.id, entity]));
  let present = 0;
  for (const entity of expected) {
    const current = existingById.get(entity.id);
    if (current === undefined) {
      continue;
    }
    if (!equivalent(current, entity)) {
      throw new DemoSeedError(
        "seed_conflict",
        `An existing ${label} conflicts with the demo seed.`,
      );
    }
    present += 1;
  }
  return present;
}

function hasUnexpectedEntities(existing: ExistingLedger, expected: ExpectedLedger): boolean {
  return (
    hasUnexpected(existing.accounts, expected.accounts) ||
    hasUnexpected(existing.categories, expected.categories) ||
    hasUnexpected(existing.transactions, expected.transactions) ||
    hasUnexpected(existing.transfers, expected.transfers)
  );
}

function hasUnexpected<Entity extends { readonly id: string }>(
  existing: readonly Entity[],
  expected: readonly Entity[],
): boolean {
  const expectedIds = ids(expected);
  return existing.some((entity) => !expectedIds.has(entity.id));
}

function ids<Entity extends { readonly id: string }>(
  entities: readonly Entity[],
): ReadonlySet<string> {
  return new Set(entities.map((entity) => entity.id));
}

function sameAccount(left: Account, right: Account): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.type === right.type &&
    left.institution === right.institution &&
    left.currency === right.currency &&
    left.parentAccountId === right.parentAccountId &&
    left.openingBalance.equals(right.openingBalance) &&
    left.isArchived === right.isArchived
  );
}

function sameCategory(left: Category, right: Category): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.kindScope === right.kindScope &&
    left.parentId === right.parentId &&
    left.isArchived === right.isArchived
  );
}

function sameTransaction(left: Transaction, right: Transaction): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.status === right.status &&
    left.accountId === right.accountId &&
    left.amount.equals(right.amount) &&
    left.bookedDate.equals(right.bookedDate) &&
    optionalDateEquals(left.valueDate, right.valueDate) &&
    left.payee === right.payee &&
    left.description === right.description &&
    left.categoryId === right.categoryId &&
    left.note === right.note &&
    left.source === right.source
  );
}

function sameTransfer(left: Transfer, right: Transfer): boolean {
  return (
    left.id === right.id &&
    left.debitTransactionId === right.debitTransactionId &&
    left.creditTransactionId === right.creditTransactionId &&
    left.feeTransactionId === right.feeTransactionId
  );
}

function optionalDateEquals(left: LocalDate | undefined, right: LocalDate | undefined): boolean {
  return left === undefined ? right === undefined : right !== undefined && left.equals(right);
}

function emptyCounts(): DemoSeedEntityCounts {
  return { accounts: 0, categories: 0, transactions: 0, transfers: 0 };
}

function result(status: DemoSeedStatus, inserted: DemoSeedEntityCounts): DemoSeedResult {
  return Object.freeze({
    version: DEMO_LEDGER_SEED_VERSION,
    status,
    inserted: Object.freeze({ ...inserted }),
  });
}
