import { InMemoryLedgerRepository } from "@nexora/database";
import { Account } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import {
  createAllocationPlan,
  deleteAllocationPlan,
  updateAllocationPlan,
} from "./allocationCommands";

describe("allocationCommands", () => {
  it("creates, updates and deletes a plan without touching transactions", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "source", name: "Origine", type: "checking", currency: "EUR" }),
    );
    await repository.saveAccount(
      Account.create({ id: "target", name: "Destinazione", type: "savings", currency: "EUR" }),
    );
    const input = {
      amountMinor: 12_000n,
      enabled: true,
      name: "Risparmio",
      sourceAccountId: "source",
      targetAccountId: "target",
      trigger: "salary" as const,
    };
    const plan = await createAllocationPlan(repository, input, () => "plan");
    await updateAllocationPlan(repository, plan.id, {
      ...input,
      enabled: false,
      name: "Risparmio pausa",
    });

    await expect(repository.listAllocationPlans()).resolves.toEqual([
      expect.objectContaining({ enabled: false, name: "Risparmio pausa" }),
    ]);
    await deleteAllocationPlan(repository, plan.id);

    await expect(repository.listAllocationPlans()).resolves.toEqual([]);
    await expect(repository.listTransactions()).resolves.toEqual([]);
  });

  it("removes allocation plans during a financial reset", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({ id: "source", name: "Origine", type: "checking", currency: "EUR" }),
    );
    await repository.saveAccount(
      Account.create({ id: "target", name: "Destinazione", type: "savings", currency: "EUR" }),
    );
    await createAllocationPlan(
      repository,
      {
        amountMinor: 12_000n,
        enabled: true,
        name: "Risparmio",
        sourceAccountId: "source",
        targetAccountId: "target",
        trigger: "salary",
      },
      () => "plan",
    );

    await repository.resetFinancialData();

    await expect(repository.listAllocationPlans()).resolves.toEqual([]);
  });
});
