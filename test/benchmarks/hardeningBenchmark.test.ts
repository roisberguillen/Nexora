import { Account, Category, LocalDate, Money, Transaction } from "../../packages/domain/src/index";
import {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  InMemoryLedgerRepository,
  validatePortableLedgerSnapshot,
} from "../../packages/database/src/index";
import { describe, expect, it } from "vitest";

type OperationName =
  | "seed"
  | "selection"
  | "trash"
  | "restore"
  | "purge"
  | "category_rebuild"
  | "preventive_backup"
  | "recovery_drill"
  | "financial_reset";

interface BenchmarkResult {
  readonly records: number;
  readonly operationsMs: Readonly<Record<OperationName, number>>;
  readonly heapUsedMiB: number;
}

async function measure<Result>(
  operations: Partial<Record<OperationName, number>>,
  name: OperationName,
  action: () => Promise<Result>,
): Promise<Result> {
  const started = performance.now();
  const result = await action();
  operations[name] = Number((performance.now() - started).toFixed(2));
  return result;
}

async function benchmarkLedger(records: number): Promise<BenchmarkResult> {
  const repository = new InMemoryLedgerRepository();
  const operations: Partial<Record<OperationName, number>> = {};
  const account = Account.create({
    id: "benchmark-account",
    name: "Synthetic benchmark account",
    type: "checking",
    currency: "EUR",
  });
  const sourceCategory = Category.create({
    id: "benchmark-source-category",
    name: "Synthetic source category",
    kindScope: "expense",
  });
  const targetCategory = Category.create({
    id: "benchmark-target-category",
    name: "Synthetic target category",
    kindScope: "expense",
  });
  await repository.saveAccount(account);
  await repository.saveCategory(sourceCategory);
  await repository.saveCategory(targetCategory);

  await measure(operations, "seed", async () => {
    for (let index = 0; index < records; index += 1) {
      await repository.saveTransaction(
        Transaction.create({
          id: `benchmark-transaction-${index}`,
          kind: "expense",
          status: "booked",
          accountId: account.id,
          amount: Money.fromMinor(-100n, "EUR"),
          bookedDate: LocalDate.parse(`2026-${String((index % 12) + 1).padStart(2, "0")}-15`),
          categoryId: sourceCategory.id,
          description: "Synthetic benchmark movement",
        }),
      );
    }
  });

  const selection = await measure(operations, "selection", () => repository.listTransactions());
  expect(selection).toHaveLength(records);
  const selectedIds = selection
    .filter((_, index) => index % Math.max(1, Math.floor(records / 100)) === 0)
    .map((transaction) => transaction.id);

  await measure(operations, "trash", () => repository.trashTransactions(selectedIds));
  expect(await repository.listTrashedTransactions()).toHaveLength(selectedIds.length);
  await measure(operations, "restore", () => repository.restoreTransaction(selectedIds[0]!));
  await measure(operations, "trash", () => repository.trashTransaction(selectedIds[0]!));
  await measure(operations, "purge", () => repository.purgeTrashedTransactions(selectedIds));
  expect(await repository.listTransactions()).toHaveLength(records - selectedIds.length);

  await measure(operations, "category_rebuild", () =>
    repository.mergeCategory(sourceCategory.id, targetCategory.id),
  );
  expect(
    (await repository.listTransactions()).every((item) => item.categoryId === targetCategory.id),
  ).toBe(true);

  const snapshot = await measure(operations, "preventive_backup", () =>
    capturePortableLedgerSnapshot(repository),
  );
  const encoded = encodePortableLedgerSnapshot(snapshot);
  const recovered = await measure(operations, "recovery_drill", async () =>
    validatePortableLedgerSnapshot(decodePortableLedgerSnapshot(encoded)),
  );
  expect(recovered.transactions).toHaveLength(records - selectedIds.length);

  await measure(operations, "financial_reset", () => repository.resetFinancialData());
  expect(await repository.listTransactions()).toHaveLength(0);
  expect((await repository.listCategories()).map((category) => category.id).sort()).toEqual([
    "system-expense",
    "system-income",
  ]);

  return {
    records,
    operationsMs: operations as Readonly<Record<OperationName, number>>,
    heapUsedMiB: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
  };
}

describe.skipIf(process.env.NEXORA_HARDENING_BENCHMARK !== "1")(
  "hardening benchmark (explicit M7 gate)",
  () => {
    it.each([1_000, 10_000, 50_000, 100_000])(
      "measures destructive recovery flows on %i synthetic movements",
      async (records) => {
        const result = await benchmarkLedger(records);
        expect(result.operationsMs).toMatchObject({
          seed: expect.any(Number),
          selection: expect.any(Number),
          trash: expect.any(Number),
          restore: expect.any(Number),
          purge: expect.any(Number),
          category_rebuild: expect.any(Number),
          preventive_backup: expect.any(Number),
          recovery_drill: expect.any(Number),
          financial_reset: expect.any(Number),
        });
        console.info(`NEXORA_HARDENING_BENCHMARK ${JSON.stringify(result)}`);
      },
      180_000,
    );
  },
);
