import { Account, Budget, Money } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { InMemoryLedgerRepository } from "./InMemoryLedgerRepository";

describe("InMemoryLedgerRepository atomic operations", () => {
  it("restores the preceding state when a restore operation fails", async () => {
    const repository = new InMemoryLedgerRepository();
    const original = Account.create({
      id: "account-original",
      name: "Originale",
      type: "checking",
      currency: "EUR",
    });
    const candidate = Account.create({
      id: "account-candidate",
      name: "Candidato",
      type: "checking",
      currency: "EUR",
    });
    await repository.saveAccount(original);

    await expect(
      repository.runAtomically(async () => {
        await repository.saveAccount(candidate);
        throw new Error("restore failed");
      }),
    ).rejects.toThrow("restore failed");

    expect((await repository.listAccounts()).map((account) => account.id)).toEqual([original.id]);
  });

  it("rejects duplicate global budgets for the same period", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveBudget(
      Budget.create({
        id: "budget-one",
        period: "2026-08",
        amount: Money.fromMinor(50_000n, "EUR"),
      }),
    );
    await expect(
      repository.saveBudget(
        Budget.create({
          id: "budget-two",
          period: "2026-08",
          amount: Money.fromMinor(60_000n, "EUR"),
        }),
      ),
    ).rejects.toMatchObject({ code: "duplicate_entity" });
  });
});
