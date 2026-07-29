import type { LedgerRepository } from "@nexora/domain";

export const PORTABLE_LEDGER_SNAPSHOT_VERSION = 1;

export interface PortableLedgerSnapshot {
  readonly formatVersion: typeof PORTABLE_LEDGER_SNAPSHOT_VERSION;
  readonly entities: Readonly<Record<string, readonly unknown[]>>;
  readonly relations: Readonly<Record<string, readonly unknown[]>>;
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
