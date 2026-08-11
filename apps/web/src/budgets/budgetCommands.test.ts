import { Category } from "@nexora/domain";
import { InMemoryLedgerRepository } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { createBudget, deactivateBudget, updateBudget } from "./budgetCommands";

describe("budget commands", () => {
  it("keeps same-month edits in place and deactivates without deleting history", async () => {
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
      "2026-08",
    );
    const updated = await updateBudget(
      repository,
      created.id,
      {
        amountMinor: 95_000n,
        categoryId: "transport",
        firstAlertPercentage: 70,
        secondAlertPercentage: 95,
      },
      () => "unused",
      "2026-08",
    );

    expect(updated.amount.amountMinor).toBe(95_000n);
    expect(updated.firstAlertPercentage).toBe(70);
    await deactivateBudget(repository, updated.id, "2026-08");
    expect(await repository.listBudgets()).toMatchObject([
      { id: updated.id, effectiveToPeriod: "2026-09" },
    ]);
  });

  it("opens a new future revision while preserving the historical revision", async () => {
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
      () => "august",
      "2026-08",
    );
    const september = await updateBudget(
      repository,
      created.id,
      {
        amountMinor: 95_000n,
        categoryId: "transport",
        firstAlertPercentage: 70,
        secondAlertPercentage: 95,
      },
      () => "september",
      "2026-09",
    );
    expect(await repository.listBudgets()).toMatchObject([
      { id: "august", effectiveToPeriod: "2026-09", seriesId: "august" },
      { id: "september", period: "2026-09", seriesId: "august" },
    ]);
    expect(september.amount.amountMinor).toBe(95_000n);
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
