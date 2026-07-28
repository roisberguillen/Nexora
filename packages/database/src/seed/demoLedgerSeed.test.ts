// @vitest-environment node

import { Account, calculateTotalBalance, summarizeCashFlow } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { InMemoryLedgerRepository } from "../in-memory/InMemoryLedgerRepository";
import { createDemoLedgerSeed, seedDemoLedger } from "./demoLedgerSeed";

describe("demoLedgerSeed", () => {
  it("crea un ledger sintetico coerente e non conta il trasferimento nel cash flow", async () => {
    const repository = new InMemoryLedgerRepository();

    await expect(seedDemoLedger(repository)).resolves.toEqual({
      version: 1,
      status: "created",
      inserted: {
        accounts: 4,
        categories: 5,
        transactions: 8,
        transfers: 1,
      },
    });

    const [accounts, categories, transactions, transfers] = await Promise.all([
      repository.listAccounts(),
      repository.listCategories(),
      repository.listTransactions(),
      repository.listTransfers(),
    ]);
    expect(accounts).toHaveLength(4);
    expect(categories).toHaveLength(5);
    expect(transactions).toHaveLength(8);
    expect(transfers).toHaveLength(1);
    expect(transactions.filter((transaction) => transaction.kind === "transfer")).toHaveLength(2);

    const cashFlow = summarizeCashFlow(transactions, "EUR");
    expect(cashFlow.income.amountMinor).toBe(240_000n);
    expect(cashFlow.expense.amountMinor).toBe(89_640n);
    expect(cashFlow.net.amountMinor).toBe(150_360n);
    expect(calculateTotalBalance(accounts, transactions, "EUR").amountMinor).toBe(513_360n);
  });

  it("è idempotente anche per invocazioni concorrenti", async () => {
    const repository = new InMemoryLedgerRepository();

    const [first, second] = await Promise.all([
      seedDemoLedger(repository),
      seedDemoLedger(repository),
    ]);

    expect(first.status).toBe("created");
    expect(second).toEqual({
      version: 1,
      status: "already_present",
      inserted: {
        accounts: 0,
        categories: 0,
        transactions: 0,
        transfers: 0,
      },
    });
    await expect(repository.listTransactions()).resolves.toHaveLength(8);
  });

  it("riprende un seed parziale compatibile rispettando le dipendenze", async () => {
    const repository = new InMemoryLedgerRepository();
    const seed = createDemoLedgerSeed();
    const firstAccount = seed.accounts[0];
    const firstCategory = seed.categories[0];
    if (firstAccount === undefined || firstCategory === undefined) {
      throw new Error("The demo seed must contain an account and a category.");
    }
    await repository.saveAccount(firstAccount);
    await repository.saveCategory(firstCategory);

    await expect(seedDemoLedger(repository)).resolves.toEqual({
      version: 1,
      status: "repaired",
      inserted: {
        accounts: 3,
        categories: 4,
        transactions: 8,
        transfers: 1,
      },
    });
    await expect(repository.listAccounts()).resolves.toHaveLength(4);
    await expect(repository.listCategories()).resolves.toHaveLength(5);
  });

  it("rifiuta un ledger non vuoto prima di aggiungere dati demo", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "existing-account",
        name: "Conto esistente",
        type: "checking",
        currency: "EUR",
      }),
    );

    await expect(seedDemoLedger(repository)).rejects.toMatchObject({
      code: "non_empty_ledger",
    });
    await expect(repository.listAccounts()).resolves.toHaveLength(1);
    await expect(repository.listCategories()).resolves.toHaveLength(0);
    await expect(repository.listTransactions()).resolves.toHaveLength(0);
  });

  it("rifiuta una collisione su un identificatore deterministico", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "demo-account-primary",
        name: "Conto incompatibile",
        type: "checking",
        currency: "EUR",
      }),
    );

    await expect(seedDemoLedger(repository)).rejects.toMatchObject({
      code: "seed_conflict",
    });
    await expect(repository.listAccounts()).resolves.toHaveLength(1);
    await expect(repository.listTransactions()).resolves.toHaveLength(0);
  });

  it("riconosce il seed completo anche dopo l'aggiunta di dati separati", async () => {
    const repository = new InMemoryLedgerRepository();
    await seedDemoLedger(repository);
    await repository.saveAccount(
      Account.create({
        id: "additional-account",
        name: "Conto aggiuntivo",
        type: "cash",
        currency: "EUR",
      }),
    );

    await expect(seedDemoLedger(repository)).resolves.toMatchObject({
      status: "already_present",
    });
    await expect(repository.listAccounts()).resolves.toHaveLength(5);
  });

  it("espone un piano immutabile con soli riferimenti sintetici", () => {
    const seed = createDemoLedgerSeed();
    const serialized = JSON.stringify(seed);

    expect(Object.isFrozen(seed)).toBe(true);
    expect(Object.isFrozen(seed.accounts)).toBe(true);
    expect(serialized).not.toMatch(/Mediobanca|N26|Directa|Findomestic|Agos|iTowers/);
    expect(serialized).toContain("campione");
  });
});
