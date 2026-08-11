import { Category } from "@nexora/domain";
import { InMemoryLedgerRepository } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { createBudget, deleteBudget, updateBudget } from "./budgetCommands";

describe("budget commands", () => {
  it("creates, updates and deletes a budget through the real repository contract", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveCategory(
      Category.create({ id: "transport", name: "Trasporti", kindScope: "expense" }),
    );
    const created = await createBudget(
      repository,
      {
        amountMinor: 80_000n,
        categoryId: "transport",
        firstAlertPercentage: 65,
        secondAlertPercentage: 90,
      },
      () => "transport-august",
    );
    const updated = await updateBudget(repository, created.id, {
      amountMinor: 95_000n,
      categoryId: "transport",
      firstAlertPercentage: 70,
      secondAlertPercentage: 95,
    });

    expect(updated.amount.amountMinor).toBe(95_000n);
    expect(updated.firstAlertPercentage).toBe(70);
    await deleteBudget(repository, updated.id);
    expect(await repository.listBudgets()).toEqual([]);
  });

  it("does not fabricate an update for a missing budget", async () => {
    const repository = new InMemoryLedgerRepository();
    await expect(
      updateBudget(repository, "missing", {
        amountMinor: 10_000n,
        categoryId: "transport",
        firstAlertPercentage: 60,
        secondAlertPercentage: 90,
      }),
    ).rejects.toMatchObject({ code: "missing_reference" });
  });
});
