import { InMemoryLedgerRepository } from "@nexora/database";
import { Account, Category } from "@nexora/domain";
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

  it("blocca una reimportazione anche quando il movimento è nel cestino", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "account-trash",
        name: "Conto demo",
        type: "checking",
        currency: "EUR",
      }),
    );
    const input = {
      filename: "movimenti.xlsx",
      sourceSha256: "d".repeat(64),
      rows: [
        {
          accountId: "account-trash",
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
    const transaction = (await repository.listTransactions())[0]!;
    await repository.trashTransaction(transaction.id);

    const repeated = await commitMoneyManagerImport(repository, input, () => crypto.randomUUID());
    expect(repeated.rowsSkipped).toBe(1);
    await expect(repository.listTransactions()).resolves.toEqual([]);
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

  it("crea entità pianificate, transfer e adjustment nello stesso commit", async () => {
    const repository = new InMemoryLedgerRepository();
    const main = Account.create({
      id: "main-account",
      name: "Conto principale demo",
      type: "checking",
      currency: "EUR",
    });
    await repository.saveAccount(main);
    const portfolio = Account.create({
      id: "portfolio-account",
      name: "Broker demo",
      type: "investment",
      currency: "EUR",
      institution: "Broker demo",
    });
    const macro = Category.create({ id: "food", name: "Alimentazione", kindScope: "expense" });
    const child = Category.create({
      id: "groceries",
      name: "Spesa alimentare",
      kindScope: "expense",
      parentId: "food",
    });
    const base = { currency: "EUR", date: "2026-07-28", message: "", status: "ready" as const };
    const rows = [
      {
        accountId: "main-account",
        categoryId: "groceries",
        kind: "expense" as const,
        message: "",
        status: "ready" as const,
        preview: {
          ...base,
          account: "Conto principale demo",
          amountMinor: -1000n,
          category: "Alimentazione",
          payee: "Demo",
          sourceRowNumber: 2,
        },
      },
      {
        accountId: "main-account",
        categoryId: undefined,
        kind: "transfer" as const,
        transferCandidateAccountId: "portfolio-account",
        message: "",
        status: "ready" as const,
        preview: {
          ...base,
          account: "Conto principale demo",
          amountMinor: -6000n,
          category: "Broker demo",
          payee: "Trasferimento",
          note: "Trasferimento",
          sourceRowNumber: 3,
        },
      },
      {
        accountId: "main-account",
        categoryId: undefined,
        kind: "adjustment" as const,
        message: "",
        status: "ready" as const,
        preview: {
          ...base,
          account: "Conto principale demo",
          amountMinor: 500n,
          category: "Modifica Saldo",
          payee: "differenza",
          sourceRowNumber: 4,
        },
      },
    ];
    const result = await commitMoneyManagerImport(repository, {
      filename: "money-manager.xlsx",
      sourceSha256: "e".repeat(64),
      accountsToCreate: [portfolio],
      categoriesToCreate: [macro, child],
      rows,
    });
    expect(result).toMatchObject({ rowsImported: 3, status: "committed" });
    await expect(repository.findAccountById("portfolio-account")).resolves.toMatchObject({
      type: "investment",
    });
    await expect(repository.findCategoryById("groceries")).resolves.toBeDefined();
    expect(await repository.listTransfers()).toHaveLength(1);
    expect(
      (await repository.listTransactions()).filter(
        (transaction) => transaction.note === "Trasferimento",
      ),
    ).toHaveLength(2);
    expect(
      (await repository.listTransactions()).filter(
        (transaction) => transaction.kind === "adjustment",
      ),
    ).toHaveLength(1);
    const repeated = await commitMoneyManagerImport(repository, {
      filename: "money-manager.xlsx",
      sourceSha256: "e".repeat(64),
      rows,
    });
    expect(repeated).toMatchObject({ rowsImported: 0, rowsSkipped: 3 });
    expect(await repository.listAccounts()).toHaveLength(2);
    expect(await repository.listCategories()).toHaveLength(2);
    expect(await repository.listTransfers()).toHaveLength(1);
    await repository.undoImportBatch(result.id);
    expect(
      (await repository.listTransactions()).every(
        (transaction) => transaction.status === "cancelled",
      ),
    ).toBe(true);
  });

  it("rimuove anche gli account pianificati quando una transazione del batch fallisce", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "new-account",
      name: "Nuovo",
      type: "checking",
      currency: "EUR",
    });
    await expect(
      commitMoneyManagerImport(repository, {
        filename: "money-manager.xlsx",
        sourceSha256: "f".repeat(64),
        accountsToCreate: [account],
        rows: [
          {
            accountId: account.id,
            categoryId: "missing-category",
            kind: "expense",
            message: "",
            status: "ready",
            preview: {
              account: "Nuovo",
              amountMinor: -1000n,
              category: "Assente",
              currency: "EUR",
              date: "2026-07-28",
              message: "",
              payee: "Demo",
              sourceRowNumber: 2,
              status: "ready",
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "missing_reference" });
    await expect(repository.findAccountById(account.id)).resolves.toBeUndefined();
    await expect(repository.listImportBatches()).resolves.toEqual([]);
    await expect(repository.listTransactions()).resolves.toEqual([]);
  });
});
