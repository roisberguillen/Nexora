import type { MoneyManagerDryRunRow } from "@nexora/importers";

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
