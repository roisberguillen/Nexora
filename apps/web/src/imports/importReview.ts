import type { MoneyManagerDryRunRow, MoneyManagerPreviewRow } from "@nexora/importers";

/**
 * Applies an explicit local-account choice without making an otherwise invalid source row ready.
 * The parser intentionally cannot know the account when the statement has no account column.
 */
export function resolvePreviewAccount(
  preview: MoneyManagerPreviewRow,
  account: string | undefined,
): MoneyManagerPreviewRow {
  if (account === undefined || account === "" || account === preview.account) return preview;
  if (
    preview.status === "needs_review" &&
    preview.account === undefined &&
    preview.date !== undefined &&
    preview.amountMinor !== undefined
  ) {
    return Object.freeze({
      ...preview,
      account,
      message: "Riga pronta per il dry-run.",
      status: "ready",
    });
  }
  return Object.freeze({ ...preview, account });
}

export function confirmedTransferRowNumbers(
  rows: readonly MoneyManagerDryRunRow[],
  confirmations: Readonly<Record<number, boolean>>,
): readonly number[] {
  return rows
    .filter(
      (row) =>
        row.transferCandidateAccountId !== undefined &&
        confirmations[row.preview.sourceRowNumber] === true,
    )
    .map((row) => row.preview.sourceRowNumber);
}

export function countCommittableImportRows(
  rows: readonly MoneyManagerDryRunRow[],
  confirmations: Readonly<Record<number, boolean>>,
): number {
  const rowNumbers = new Set(
    rows.filter((row) => row.status === "ready").map((row) => row.preview.sourceRowNumber),
  );
  confirmedTransferRowNumbers(rows, confirmations).forEach((rowNumber) =>
    rowNumbers.add(rowNumber),
  );
  return rowNumbers.size;
}
