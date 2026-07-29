import { Account } from "@nexora/domain";
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
});
