import { Account, Money } from "@nexora/domain";
import { InMemoryLedgerRepository } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  createInvestmentPosition,
  deleteInvestmentPosition,
  updateInvestmentPosition,
} from "./investmentCommands";

describe("investment commands", () => {
  it("creates, updates and deletes a manual position without touching its account", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "investment-account",
      name: "Broker demo",
      type: "investment",
      currency: "EUR",
    });
    await repository.saveAccount(account);
    const created = await createInvestmentPosition(
      repository,
      {
        accountId: account.id,
        name: "ETF globale",
        costBasisMinor: 100_000n,
        currentValueMinor: 105_000n,
        valuationDate: "2026-08-13",
      },
      () => "position-1",
    );
    const updated = await updateInvestmentPosition(repository, created.id, {
      accountId: account.id,
      name: "ETF globale aggiornato",
      symbol: "VWCE",
      costBasisMinor: 100_000n,
      currentValueMinor: 110_000n,
      valuationDate: "2026-08-14",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.currentValue).toEqual(Money.fromMinor(110_000n, "EUR"));
    expect(await repository.findAccountById(account.id)).toEqual(account);

    await deleteInvestmentPosition(repository, updated.id);
    expect(await repository.listInvestmentPositions()).toEqual([]);
    expect(await repository.findAccountById(account.id)).toEqual(account);
  });

  it("cannot update a valid position to an incompatible account", async () => {
    const repository = new InMemoryLedgerRepository();
    const investment = Account.create({
      id: "investment",
      name: "Broker demo",
      type: "investment",
      currency: "EUR",
    });
    const checking = Account.create({
      id: "checking",
      name: "Conto demo",
      type: "checking",
      currency: "EUR",
    });
    await repository.saveAccount(investment);
    await repository.saveAccount(checking);
    const position = await createInvestmentPosition(
      repository,
      {
        accountId: investment.id,
        name: "ETF",
        costBasisMinor: 1n,
        currentValueMinor: 1n,
        valuationDate: "2026-08-13",
      },
      () => "position",
    );
    await expect(
      updateInvestmentPosition(repository, position.id, {
        accountId: checking.id,
        name: "ETF",
        costBasisMinor: 1n,
        currentValueMinor: 1n,
        valuationDate: "2026-08-13",
      }),
    ).rejects.toThrow("active investment");
  });
});
