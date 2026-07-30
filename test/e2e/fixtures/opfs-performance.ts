import { openOpfsLedger } from "../../../packages/database/src";
import { Account, Category } from "../../../packages/domain/src";

const transactionCount = 100_000;
const batchSize = 1_000;

export interface OpfsPerformanceResult {
  readonly insertedRecords: number;
  readonly listedRecords: number;
  readonly openMs: number;
  readonly insertMs: number;
  readonly reopenMs: number;
  readonly listMs: number;
}

export async function runOpfsPerformanceTest(filename: string): Promise<OpfsPerformanceResult> {
  const directoryName = filename.split("/").filter(Boolean)[0];
  if (directoryName === undefined)
    throw new Error("The OPFS performance filename has no directory.");

  const openedAt = performance.now();
  const initialLedger = await openOpfsLedger({ filename });
  const openMs = elapsedSince(openedAt);

  try {
    await initialLedger.repository.saveAccount(
      Account.create({
        id: "performance-account",
        name: "Conto sintetico performance",
        type: "checking",
        currency: "EUR",
      }),
    );
    await initialLedger.repository.saveCategory(
      Category.create({
        id: "performance-category",
        name: "Categoria sintetica performance",
        kindScope: "expense",
      }),
    );

    const insertStartedAt = performance.now();
    await initialLedger.database.execute("BEGIN IMMEDIATE;");
    try {
      for (let start = 0; start < transactionCount; start += batchSize) {
        await initialLedger.database.execute(
          transactionInsertSql(start, Math.min(start + batchSize, transactionCount)),
        );
      }
      await initialLedger.database.execute("COMMIT;");
    } catch (error) {
      await initialLedger.database.execute("ROLLBACK;").catch(() => undefined);
      throw error;
    }
    const insertMs = elapsedSince(insertStartedAt);
    await initialLedger.close();

    const reopenStartedAt = performance.now();
    const reopenedLedger = await openOpfsLedger({ filename });
    const reopenMs = elapsedSince(reopenStartedAt);
    try {
      const listStartedAt = performance.now();
      const transactions = await reopenedLedger.repository.listTransactions();
      const listMs = elapsedSince(listStartedAt);
      if (transactions.length !== transactionCount) {
        throw new Error(
          `Expected ${transactionCount} persisted transactions, found ${transactions.length}.`,
        );
      }
      return {
        insertedRecords: transactionCount,
        listedRecords: transactions.length,
        openMs,
        insertMs,
        reopenMs,
        listMs,
      };
    } finally {
      await reopenedLedger.close();
    }
  } finally {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(directoryName, { recursive: true });
  }
}

function transactionInsertSql(start: number, end: number): string {
  const values: string[] = [];
  for (let index = start; index < end; index += 1) {
    const month = String((index % 12) + 1).padStart(2, "0");
    values.push(
      `('performance-transaction-${index}', 'expense', 'booked', 'performance-account', '-100', 'EUR', '2026-${month}-15', NULL, NULL, 'Synthetic performance transaction', 'performance-category', NULL, 'system', NULL, NULL)`,
    );
  }
  return `INSERT INTO transactions (id, kind, status, account_id, amount_minor, currency, booked_date, value_date, payee, description, category_id, note, source, import_batch_id, source_fingerprint) VALUES ${values.join(",")};`;
}

function elapsedSince(startedAt: number): number {
  return Number((performance.now() - startedAt).toFixed(2));
}
