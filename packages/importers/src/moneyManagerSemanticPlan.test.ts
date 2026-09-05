import { Account, Category } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import type { MoneyManagerPreviewRow } from "./moneyManagerPreview";
import { buildMoneyManagerSemanticPlan } from "./moneyManagerSemanticPlan";

const row = (input: Partial<MoneyManagerPreviewRow>): MoneyManagerPreviewRow => ({
  account: "N26",
  amountMinor: -1000n,
  category: "Alimentazione",
  sourceCategory: "Alimentazione",
  sourceSubcategory: "Spesa alimentare",
  sourceType: "Spesa",
  currency: "EUR",
  date: "2026-08-01",
  message: "",
  payee: "Demo",
  sourceRowNumber: 2,
  status: "ready",
  ...input,
});

describe("Money Manager semantic plan", () => {
  it("creates one decision for each source account and reuses the unique N26 account", () => {
    const n26 = Account.create({
      id: "n26-main",
      name: "n26 - Principale",
      currency: "EUR",
      type: "checking",
    });
    const plan = buildMoneyManagerSemanticPlan(
      [
        row({}),
        row({ sourceRowNumber: 3 }),
        row({
          account: "Diretta sim",
          sourceType: "Trasferimento uscita",
          sourceCategory: "N26",
          category: "N26",
        }),
      ],
      [n26],
      [],
      (() => {
        let id = 0;
        return () => String(++id);
      })(),
    );
    expect(plan.accounts).toHaveLength(2);
    expect(plan.accounts[0]).toMatchObject({
      sourceName: "N26",
      targetAccountId: "n26-main",
      status: "existing",
    });
    expect(plan.accounts[1]).toMatchObject({
      sourceName: "Diretta sim",
      status: "to_create",
      proposedAccount: { type: "investment", currency: "EUR" },
    });
  });

  it("recognizes the real Directa SIM institution name as an investment", () => {
    const plan = buildMoneyManagerSemanticPlan(
      [
        row({
          account: "Directa SIM",
          sourceRowNumber: 9,
          sourceType: "Guadagno",
          category: "Modifica Saldo",
          sourceCategory: "Modifica Saldo",
        }),
      ],
      [],
      [],
      (() => {
        let id = 0;
        return () => `directa-${++id}`;
      })(),
    );
    expect(plan.accounts[0]).toMatchObject({
      sourceName: "Directa SIM",
      status: "to_create",
      proposedAccount: { name: "Directa SIM", type: "investment", institution: "Directa SIM" },
    });
  });

  it("plans a missing hierarchy once and excludes transfer destinations and adjustments", () => {
    const plan = buildMoneyManagerSemanticPlan(
      [
        row({}),
        row({ sourceRowNumber: 3 }),
        row({ sourceRowNumber: 4, sourceCategory: "Modifica Saldo", category: "Modifica Saldo" }),
        row({
          sourceRowNumber: 5,
          sourceType: "Trasferimento uscita",
          sourceCategory: "Diretta sim",
          category: "Diretta sim",
        }),
      ],
      [],
      [],
      (() => {
        let id = 0;
        return () => String(++id);
      })(),
    );
    expect(plan.categories).toHaveLength(1);
    expect(plan.categories[0]).toMatchObject({
      sourceCategory: "Alimentazione",
      sourceSubcategory: "Spesa alimentare",
      status: "to_create",
    });
    expect(plan.categoriesToCreate).toEqual([
      expect.objectContaining({ name: "Alimentazione", parentId: undefined }),
      expect.objectContaining({ name: "Spesa alimentare" }),
    ]);
  });

  it("matches an exact child only below the matching macro", () => {
    const macro = Category.create({ id: "food", name: "Alimentazione", kindScope: "expense" });
    const child = Category.create({
      id: "groceries",
      name: "Spesa alimentare",
      kindScope: "expense",
      parentId: "food",
    });
    const plan = buildMoneyManagerSemanticPlan([row({})], [], [macro, child]);
    expect(plan.categories[0]).toMatchObject({ targetCategoryId: "groceries", status: "existing" });
    expect(plan.categoriesToCreate).toHaveLength(0);
  });

  it("creates a missing macro once for several child paths", () => {
    const plan = buildMoneyManagerSemanticPlan(
      [
        row({ sourceSubcategory: "Spesa alimentare" }),
        row({ sourceRowNumber: 3, sourceSubcategory: "Supermercato" }),
      ],
      [],
      [],
      (() => {
        let id = 0;
        return () => String(++id);
      })(),
    );
    expect(
      plan.categoriesToCreate.filter((category) => category.parentId === undefined),
    ).toHaveLength(1);
    expect(
      plan.categoriesToCreate.filter((category) => category.parentId !== undefined),
    ).toHaveLength(2);
    expect(new Set(plan.categoriesToCreate.map((category) => category.id)).size).toBe(3);
  });

  it("applies one saved semantic decision to a generic source account", () => {
    const plan = buildMoneyManagerSemanticPlan(
      [row({ account: "Conto nuovo" }), row({ account: "Conto nuovo", sourceRowNumber: 3 })],
      [],
      [],
      (() => {
        let id = 0;
        return () => `future-${++id}`;
      })(),
      {
        accountConfigurations: { "conto nuovo": { type: "savings" } },
      },
    );
    expect(plan.accounts).toHaveLength(1);
    expect(plan.accounts[0]).toMatchObject({
      status: "to_create",
      proposedAccount: { type: "savings", currency: "EUR", openingBalance: { amountMinor: 0n } },
    });
  });

  it("uses saved account and category aliases before name matching", () => {
    const account = Account.create({
      id: "bank-target",
      name: "Nome locale",
      currency: "EUR",
      type: "checking",
    });
    const category = Category.create({ id: "food-target", name: "Cibo", kindScope: "expense" });
    const plan = buildMoneyManagerSemanticPlan(
      [row({ account: "Alias banca", sourceSubcategory: "" })],
      [account],
      [category],
      () => "unused",
      {
        accountMappings: { "alias banca": "bank-target" },
        categoryMappings: { "alimentazione\u0000": "food-target" },
      },
    );
    expect(plan.accounts[0]).toMatchObject({ status: "existing", targetAccountId: "bank-target" });
    expect(plan.categories[0]).toMatchObject({
      status: "existing",
      targetCategoryId: "food-target",
    });
  });
});
