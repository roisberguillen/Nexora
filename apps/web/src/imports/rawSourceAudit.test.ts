import { InMemoryLedgerRepository } from "@nexora/database";
import { Account } from "@nexora/domain";
import { dryRunMoneyManagerRows, previewMoneyManagerRows } from "@nexora/importers";
import { describe, expect, it } from "vitest";

import { commitMoneyManagerImport } from "./importCommands";

describe("import raw source audit", () => {
  it("persists the original source cells without replacing them with normalized values", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "account-raw-audit",
      name: "Conto demo",
      type: "checking",
      currency: "EUR",
    });
    await repository.saveAccount(account);
    const preview = previewMoneyManagerRows([["02/08/2026", "Conto demo", "-12,50", "Cinema"]], {
      date: 0,
      account: 1,
      amount: 2,
      payee: 3,
    });
    const rows = dryRunMoneyManagerRows(preview, [account], [], []);

    const batch = await commitMoneyManagerImport(
      repository,
      {
        filename: "movimenti.xlsx",
        sourceSha256: "d".repeat(64),
        rows,
      },
      () => crypto.randomUUID(),
    );
    const [auditRow] = await repository.listImportRows(batch.id);
    const rawAudit = JSON.parse(auditRow!.rawJson) as {
      readonly amountMinor: string;
      readonly date: string;
      readonly rawValues: readonly string[];
    };

    expect(rawAudit).toMatchObject({
      amountMinor: "-1250",
      date: "2026-08-02",
      rawValues: ["02/08/2026", "Conto demo", "-12,50", "Cinema"],
    });
  });
});
