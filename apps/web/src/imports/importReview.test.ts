import type { MoneyManagerDryRunRow, MoneyManagerPreviewRow } from "@nexora/importers";
import { describe, expect, it } from "vitest";

import {
  confirmedTransferRowNumbers,
  countCommittableImportRows,
  resolvePreviewAccount,
} from "./importReview";

function row(
  sourceRowNumber: number,
  status: MoneyManagerDryRunRow["status"],
  transferCandidateAccountId?: string,
): MoneyManagerDryRunRow {
  return {
    accountId: "account-1",
    categoryId: undefined,
    kind: status === "ready" ? "expense" : undefined,
    message: "",
    preview: {
      account: "Conto",
      amountMinor: -100n,
      category: undefined,
      currency: "EUR",
      date: "2026-08-02",
      message: "",
      payee: "Riserva",
      sourceRowNumber,
      status: "ready",
    },
    status,
    ...(transferCandidateAccountId === undefined ? {} : { transferCandidateAccountId }),
  };
}

describe("import review confirmation", () => {
  it("makes an account-less but otherwise valid row ready after explicit account resolution", () => {
    const preview: MoneyManagerPreviewRow = {
      account: undefined,
      amountMinor: -100n,
      category: undefined,
      currency: "EUR",
      date: "2026-08-02",
      message: "Conto assente: richiede risoluzione prima dell'importazione.",
      payee: undefined,
      sourceRowNumber: 2,
      status: "needs_review",
    };

    expect(resolvePreviewAccount(preview, "Conto validazione")).toMatchObject({
      account: "Conto validazione",
      status: "ready",
    });
  });

  it("does not make an invalid date or amount ready when an account is resolved", () => {
    const preview: MoneyManagerPreviewRow = {
      account: undefined,
      amountMinor: undefined,
      category: undefined,
      currency: "EUR",
      date: undefined,
      message: "Data o importo non interpretabile: richiede revisione.",
      payee: undefined,
      sourceRowNumber: 2,
      status: "needs_review",
    };

    expect(resolvePreviewAccount(preview, "Conto validazione")).toMatchObject({
      account: "Conto validazione",
      status: "needs_review",
    });
  });

  it("keeps an unconfirmed transfer out of the committable count", () => {
    expect(countCommittableImportRows([row(2, "needs_review", "account-2")], {})).toBe(0);
  });

  it("allows a batch containing only a confirmed transfer", () => {
    const rows = [row(2, "needs_review", "account-2")];
    expect(confirmedTransferRowNumbers(rows, { 2: true })).toEqual([2]);
    expect(countCommittableImportRows(rows, { 2: true })).toBe(1);
  });

  it("counts ready rows and confirmed transfers once", () => {
    expect(
      countCommittableImportRows([row(2, "ready"), row(3, "needs_review", "account-2")], {
        3: true,
      }),
    ).toBe(2);
  });
});
