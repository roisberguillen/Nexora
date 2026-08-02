import {
  ImportBatch,
  ImportRow,
  LocalDate,
  Money,
  Transaction,
  Transfer,
  type ImportTransferBundle,
  type ImporterType,
  type LedgerRepository,
} from "@nexora/domain";
import type { MoneyManagerDryRunRow } from "@nexora/importers";

export async function commitMoneyManagerImport(
  repository: LedgerRepository,
  input: {
    readonly filename: string;
    readonly importerType?: ImporterType;
    readonly rows: readonly MoneyManagerDryRunRow[];
    readonly sourceSha256: string;
    readonly mappingProfileId?: string;
    readonly confirmedTransferRowNumbers?: readonly number[];
  },
  idFactory: () => string = () => crypto.randomUUID(),
): Promise<ImportBatch> {
  const batch = ImportBatch.create({
    id: `batch-${idFactory()}`,
    importerType: input.importerType ?? "money_manager_xlsx",
    rowsTotal: input.rows.length,
    sourceFilename: input.filename,
    sourceSha256: input.sourceSha256,
    ...(input.mappingProfileId === undefined ? {} : { mappingProfileId: input.mappingProfileId }),
  });
  const [activeTransactions, trashedTransactions] = await Promise.all([
    repository.listTransactions(),
    repository.listTrashedTransactions(),
  ]);
  const existingFingerprints = new Set(
    [...activeTransactions, ...trashedTransactions.map((entry) => entry.transaction)]
      .filter(
        (transaction) =>
          transaction.source === "import" && transaction.sourceFingerprint !== undefined,
      )
      .map((transaction) => `${transaction.accountId}|${transaction.sourceFingerprint}`),
  );
  const transactions: Transaction[] = [];
  const transferBundles: ImportTransferBundle[] = [];
  const rows: ImportRow[] = [];
  const confirmedTransfers = new Set(input.confirmedTransferRowNumbers ?? []);
  for (const result of input.rows) {
    const preview = result.preview;
    const isConfirmedTransfer =
      result.transferCandidateAccountId !== undefined &&
      confirmedTransfers.has(preview.sourceRowNumber) &&
      result.accountId !== undefined &&
      preview.amountMinor !== undefined &&
      preview.date !== undefined;
    if (isConfirmedTransfer) {
      const sourceAccount = await repository.findAccountById(result.accountId!);
      const counterpartyAccount = await repository.findAccountById(
        result.transferCandidateAccountId!,
      );
      if (
        sourceAccount === undefined ||
        counterpartyAccount === undefined ||
        sourceAccount.isArchived ||
        counterpartyAccount.isArchived ||
        sourceAccount.currency !== counterpartyAccount.currency
      ) {
        throw new Error("invalid_transfer_import");
      }
      const amount = preview.amountMinor!;
      const sourceFingerprint = await fingerprint(
        `${input.sourceSha256}|${preview.sourceRowNumber}|${result.accountId}|${amount.toString()}|transfer-source`,
      );
      const counterpartFingerprint = await fingerprint(
        `${input.sourceSha256}|${preview.sourceRowNumber}|${result.transferCandidateAccountId}|${amount.toString()}|transfer-counterpart`,
      );
      const isDebit = amount < 0n;
      const debit = Transaction.create({
        id: `transaction-${idFactory()}`,
        kind: "transfer",
        status: "booked",
        accountId: isDebit ? sourceAccount.id : counterpartyAccount.id,
        amount: Money.fromMinor(-abs(amount), sourceAccount.currency),
        bookedDate: LocalDate.parse(preview.date!),
        source: "import",
        importBatchId: batch.id,
        sourceFingerprint: isDebit ? sourceFingerprint : counterpartFingerprint,
        ...(preview.payee === undefined ? {} : { payee: preview.payee }),
      });
      const credit = Transaction.create({
        id: `transaction-${idFactory()}`,
        kind: "transfer",
        status: "booked",
        accountId: isDebit ? counterpartyAccount.id : sourceAccount.id,
        amount: Money.fromMinor(abs(amount), sourceAccount.currency),
        bookedDate: LocalDate.parse(preview.date!),
        source: "import",
        importBatchId: batch.id,
        sourceFingerprint: isDebit ? counterpartFingerprint : sourceFingerprint,
        ...(preview.payee === undefined ? {} : { payee: preview.payee }),
      });
      const auditTransaction = isDebit ? debit : credit;
      const transfer = Transfer.create({
        id: `transfer-${idFactory()}`,
        debitTransaction: debit,
        creditTransaction: credit,
      });
      transferBundles.push({
        auditTransactionId: auditTransaction.id,
        transfer,
        debitTransaction: debit,
        creditTransaction: credit,
      });
      rows.push(
        ImportRow.create({
          id: `import-row-${idFactory()}`,
          batchId: batch.id,
          rowNumber: preview.sourceRowNumber,
          rawJson: serializePreview(preview),
          normalizedJson: JSON.stringify({
            accountId: result.accountId,
            kind: "transfer",
            counterpartyAccountId: result.transferCandidateAccountId,
          }),
          status: "imported",
          createdTransactionId: auditTransaction.id,
        }),
      );
      continue;
    }
    if (
      result.status !== "ready" ||
      result.accountId === undefined ||
      result.kind === undefined ||
      preview.amountMinor === undefined ||
      preview.date === undefined
    ) {
      rows.push(
        ImportRow.create({
          id: `import-row-${idFactory()}`,
          batchId: batch.id,
          rowNumber: preview.sourceRowNumber,
          rawJson: serializePreview(preview),
          status: result.status === "skipped_duplicate" ? "skipped_duplicate" : "needs_review",
        }),
      );
      continue;
    }
    const sourceFingerprint = await fingerprint(
      `${input.sourceSha256}|${preview.sourceRowNumber}|${result.accountId}|${preview.amountMinor.toString()}|${preview.payee ?? ""}`,
    );
    if (existingFingerprints.has(`${result.accountId}|${sourceFingerprint}`)) {
      rows.push(
        ImportRow.create({
          id: `import-row-${idFactory()}`,
          batchId: batch.id,
          rowNumber: preview.sourceRowNumber,
          rawJson: serializePreview(preview),
          status: "skipped_duplicate",
        }),
      );
      continue;
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
      sourceFingerprint,
      ...(result.categoryId === undefined ? {} : { categoryId: result.categoryId }),
      ...(preview.payee === undefined ? {} : { payee: preview.payee }),
    });
    transactions.push(transaction);
    existingFingerprints.add(`${result.accountId}|${sourceFingerprint}`);
    rows.push(
      ImportRow.create({
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
      }),
    );
  }
  return repository.commitImportBatch(batch, rows, transactions, transferBundles);
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
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
