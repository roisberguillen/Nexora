import { InMemoryLedgerRepository } from "@nexora/database";
import { Account } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { commitMoneyManagerImport } from "./importCommands";

describe("commitMoneyManagerImport", () => {
  it("crea un batch atomico con una riga pronta", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "account-1", name: "Conto demo", type: "checking", currency: "EUR" }),
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
              account: "Conto demo",
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

  it("conserva l'audit ma salta una riga gia importata dallo stesso file", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "account-1", name: "Conto demo", type: "checking", currency: "EUR" }),
    );
    const input = {
      filename: "movimenti.xlsx",
      sourceSha256: "b".repeat(64),
      rows: [
        {
          accountId: "account-1",
          categoryId: undefined,
          kind: "expense" as const,
          message: "Pronta",
          preview: {
            account: "Conto demo",
            amountMinor: -1250n,
            category: undefined,
            currency: "EUR",
            date: "2026-07-28",
            message: "",
            payee: "Cinema",
            sourceRowNumber: 2,
            status: "ready" as const,
          },
          status: "ready" as const,
        },
      ],
    };

    await commitMoneyManagerImport(repository, input, () => crypto.randomUUID());
    const repeated = await commitMoneyManagerImport(repository, input, () => crypto.randomUUID());

    expect(repeated).toMatchObject({ status: "committed", rowsImported: 0, rowsSkipped: 1 });
    await expect(repository.listTransactions()).resolves.toHaveLength(1);
    await expect(repository.listImportRows(repeated.id)).resolves.toMatchObject([
      { status: "skipped_duplicate" },
    ]);
  });

  it("crea entrambe le gambe solo dopo la conferma del trasferimento", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "main", name: "Principale", type: "checking", currency: "EUR" }),
    );
    await repository.saveAccount(
      Account.create({ id: "savings", name: "Risparmi", type: "savings", currency: "EUR" }),
    );
    const result = await commitMoneyManagerImport(
      repository,
      {
        filename: "movimenti.xlsx",
        sourceSha256: "c".repeat(64),
        confirmedTransferRowNumbers: [2],
        rows: [
          {
            accountId: "main",
            categoryId: undefined,
            kind: undefined,
            status: "needs_review",
            transferCandidateAccountId: "savings",
            message: "Possibile trasferimento",
            preview: {
              account: "Principale",
              amountMinor: -5000n,
              currency: "EUR",
              date: "2026-07-28",
              payee: "Risparmi",
              sourceRowNumber: 2,
              status: "ready",
              message: "",
              category: undefined,
            },
          },
        ],
      },
      () => crypto.randomUUID(),
    );
    expect(result).toMatchObject({ status: "committed", rowsImported: 1 });
    await expect(repository.listTransactions()).resolves.toHaveLength(2);
    await expect(repository.listTransfers()).resolves.toHaveLength(1);
  });
});
