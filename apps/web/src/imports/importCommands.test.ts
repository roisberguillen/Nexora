import { InMemoryLedgerRepository } from "@nexora/database";
import { Account } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { commitMoneyManagerImport } from "./importCommands";

describe("commitMoneyManagerImport", () => {
  it("crea un batch atomico con una riga pronta", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "account-1", name: "N26", type: "checking", currency: "EUR" }),
    );
    const batch = await commitMoneyManagerImport(
      repository,
      {
        filename: "movimenti.xlsx",
        sourceSha256: "a".repeat(64),
        rows: [
          {
            accountId: "account-1",
            categoryId: undefined,
            kind: "expense",
            message: "Pronta",
            preview: {
              account: "N26",
              amountMinor: -1250n,
              category: undefined,
              currency: "EUR",
              date: "2026-07-28",
              message: "",
              payee: "Cinema",
              sourceRowNumber: 2,
              status: "ready",
            },
            status: "ready",
          },
        ],
      },
      (() => "id") as () => string,
    );
    expect(batch.status).toBe("committed");
    await expect(repository.listImportRows(batch.id)).resolves.toHaveLength(1);
    await expect(repository.listTransactions()).resolves.toHaveLength(1);
  });
});
