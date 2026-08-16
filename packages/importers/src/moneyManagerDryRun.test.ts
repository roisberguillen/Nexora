import { Account, Category } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { dryRunMoneyManagerRows } from "./moneyManagerDryRun";

describe("Money Manager dry-run", () => {
  it("risolve riferimenti esatti e blocca categorie incompatibili", () => {
    const account = Account.create({
      currency: "EUR",
      id: "account-1",
      name: "N26",
      type: "checking",
    });
    const expense = Category.create({ id: "category-1", kindScope: "expense", name: "Spesa" });
    const rows = [
      {
        account: "N26",
        amountMinor: -1250n,
        category: "Spesa",
        currency: "EUR",
        date: "2026-07-28",
        message: "",
        payee: "Cinema",
        sourceRowNumber: 2,
        status: "ready" as const,
      },
      {
        account: "N26",
        amountMinor: 1250n,
        category: "Spesa",
        currency: "EUR",
        date: "2026-07-28",
        message: "",
        payee: "Stipendio",
        sourceRowNumber: 3,
        status: "ready" as const,
      },
    ];

    expect(dryRunMoneyManagerRows(rows, [account], [expense], [])).toEqual([
      expect.objectContaining({
        accountId: "account-1",
        categoryId: "category-1",
        kind: "expense",
        status: "ready",
      }),
      expect.objectContaining({ kind: "income", status: "needs_review" }),
    ]);
  });

  it("segnala come revisione un possibile trasferimento verso un conto locale", () => {
    const n26 = Account.create({ currency: "EUR", id: "n26", name: "N26", type: "checking" });
    const space = Account.create({
      currency: "EUR",
      id: "space",
      name: "Spazio risparmio",
      parentAccountId: "n26",
      type: "virtual_subaccount",
    });
    const [result] = dryRunMoneyManagerRows(
      [
        {
          account: "N26",
          amountMinor: -6000n,
          category: undefined,
          currency: "EUR",
          date: "2026-07-28",
          message: "",
          payee: "Spazio risparmio",
          sourceRowNumber: 2,
          status: "ready",
        },
      ],
      [n26, space],
      [],
      [],
    );
    expect(result).toMatchObject({ status: "needs_review", kind: undefined });
    expect(result?.message).toContain("Possibile trasferimento");
  });

  it("risolve una sotto-categoria solo sotto la macro Money Manager corrispondente", () => {
    const account = Account.create({
      currency: "EUR",
      id: "account-1",
      name: "N26",
      type: "checking",
    });
    const macro = Category.create({ id: "food", kindScope: "expense", name: "Alimentazione" });
    const child = Category.create({
      id: "food-groceries",
      kindScope: "expense",
      name: "Spesa alimentare",
      parentId: "food",
    });
    const [result] = dryRunMoneyManagerRows(
      [
        {
          account: "N26",
          amountMinor: -7219n,
          category: "Alimentazione",
          sourceCategory: "Alimentazione",
          sourceSubcategory: "Spesa alimentare",
          currency: "EUR",
          date: "2026-07-28",
          message: "",
          payee: "Demo",
          sourceRowNumber: 2,
          status: "ready",
        },
      ],
      [account],
      [macro, child],
      [],
    );
    expect(result).toMatchObject({
      accountId: "account-1",
      categoryId: "food-groceries",
      kind: "expense",
      status: "ready",
    });
  });
});
