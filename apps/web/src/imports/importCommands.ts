import {
  ImportBatch,
  ImportRow,
  LocalDate,
  Money,
  Transaction,
  type LedgerRepository,
} from "@nexora/domain";
import type { MoneyManagerDryRunRow } from "@nexora/importers";

export async function commitMoneyManagerImport(
  repository: LedgerRepository,
  input: {
    readonly filename: string;
    readonly rows: readonly MoneyManagerDryRunRow[];
    readonly sourceSha256: string;
  },
  idFactory: () => string = () => crypto.randomUUID(),
): Promise<ImportBatch> {
  const batch = ImportBatch.create({
    id: `batch-${idFactory()}`,
    importerType: "money_manager_xlsx",
    rowsTotal: input.rows.length,
    sourceFilename: input.filename,
    sourceSha256: input.sourceSha256,
  });
  const transactions: Transaction[] = [];
  const rows = await Promise.all(
    input.rows.map(async (result) => {
      const preview = result.preview;
      if (
        result.status !== "ready" ||
        result.accountId === undefined ||
        result.kind === undefined ||
        preview.amountMinor === undefined ||
        preview.date === undefined
      ) {
        return ImportRow.create({
          id: `import-row-${idFactory()}`,
          batchId: batch.id,
          rowNumber: preview.sourceRowNumber,
          rawJson: serializePreview(preview),
          status: result.status === "skipped_duplicate" ? "skipped_duplicate" : "needs_review",
        });
      }
      const transaction = Transaction.create({
        id: `transaction-${idFactory()}`,
        kind: result.kind,
        status: "booked",
        accountId: result.accountId,
        amount: Money.fromMinor(preview.amountMinor, preview.currency ?? "EUR"),
        bookedDate: LocalDate.parse(preview.date),
        source: "import",
        importBatchId: batch.id,
        sourceFingerprint: await fingerprint(
          `${input.sourceSha256}|${preview.sourceRowNumber}|${result.accountId}|${preview.amountMinor.toString()}|${preview.payee ?? ""}`,
        ),
        ...(result.categoryId === undefined ? {} : { categoryId: result.categoryId }),
        ...(preview.payee === undefined ? {} : { payee: preview.payee }),
      });
      transactions.push(transaction);
      return ImportRow.create({
        id: `import-row-${idFactory()}`,
        batchId: batch.id,
        rowNumber: preview.sourceRowNumber,
        rawJson: serializePreview(preview),
        normalizedJson: JSON.stringify({
          accountId: result.accountId,
          categoryId: result.categoryId,
          kind: result.kind,
        }),
        status: "imported",
        createdTransactionId: transaction.id,
      });
    }),
  );
  return repository.commitImportBatch(batch, rows, transactions);
}

export async function sha256(bytes: ArrayBuffer): Promise<string> {
  return fingerprintBytes(new Uint8Array(bytes));
}
async function fingerprint(value: string): Promise<string> {
  return fingerprintBytes(new TextEncoder().encode(value));
}
async function fingerprintBytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function serializePreview(preview: MoneyManagerDryRunRow["preview"]): string {
  return JSON.stringify({ ...preview, amountMinor: preview.amountMinor?.toString() });
}
