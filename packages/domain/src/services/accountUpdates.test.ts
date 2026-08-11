import { describe, expect, it } from "vitest";

import { Account } from "../entities/Account";
import { Money } from "../value-objects/Money";
import { validateAccountUpdate } from "./accountUpdates";

const noBlockingFacts = {
  hasActiveChildren: false,
  hasTransactions: false,
  parentIsArchived: false,
} as const;

function account() {
  return Account.create({
    id: "account-demo",
    name: "Conto demo",
    type: "checking",
    currency: "EUR",
    openingBalance: Money.fromMinor(10_000n, "EUR"),
  });
}

describe("validateAccountUpdate", () => {
  it("consente dati descrittivi e saldo iniziale prima dei movimenti", () => {
    const existing = account();
    const updated = existing.update({
      name: "Conto aggiornato",
      openingBalance: Money.fromMinor(12_500n, "EUR"),
    });

    expect(() => validateAccountUpdate(existing, updated, noBlockingFacts)).not.toThrow();
  });

  it("blocca la modifica retroattiva del saldo iniziale", () => {
    const existing = account();
    const updated = existing.update({
      openingBalance: Money.fromMinor(12_500n, "EUR"),
    });

    expect(() =>
      validateAccountUpdate(existing, updated, {
        ...noBlockingFacts,
        hasTransactions: true,
      }),
    ).toThrowError(/Opening balance/);
  });

  it("protegge la gerarchia durante archiviazione e ripristino", () => {
    const existing = account();

    expect(() =>
      validateAccountUpdate(existing, existing.update({ isArchived: true }), {
        ...noBlockingFacts,
        hasActiveChildren: true,
      }),
    ).toThrowError(/active subaccounts/);

    const archivedSpace = Account.create({
      id: "space-demo",
      name: "Spazio demo",
      type: "virtual_subaccount",
      currency: "EUR",
      parentAccountId: existing.id,
      isArchived: true,
    });
    expect(() =>
      validateAccountUpdate(archivedSpace, archivedSpace.update({ isArchived: false }), {
        ...noBlockingFacts,
        parentIsArchived: true,
      }),
    ).toThrowError(/parent is archived/);

    expect(() =>
      validateAccountUpdate(existing, existing.update({ isArchived: true }), {
        ...noBlockingFacts,
        hasEnabledAllocationPlans: true,
      }),
    ).toThrowError(/active allocation plan/);
  });
});
