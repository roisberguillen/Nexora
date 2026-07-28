import { describe, expect, it } from "vitest";

import { DomainError } from "../errors/DomainError";
import { Money } from "../value-objects/Money";
import { Account } from "./Account";

describe("Account", () => {
  it("crea conti con saldo iniziale nella valuta dichiarata", () => {
    const account = Account.create({
      id: "account-main",
      name: "Conto Demo",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(25_000n, "EUR"),
    });

    expect(account.openingBalance.amountMinor).toBe(25_000n);
    expect(account.isArchived).toBe(false);
  });

  it("richiede un parent per i sottoconti virtuali", () => {
    expect(() =>
      Account.create({
        id: "space-demo",
        name: "Spazio Demo",
        type: "virtual_subaccount",
        currency: "EUR",
      }),
    ).toThrowError(DomainError);

    expect(
      Account.create({
        id: "space-demo",
        name: "Spazio Demo",
        type: "virtual_subaccount",
        currency: "EUR",
        parentAccountId: "account-main",
      }).parentAccountId,
    ).toBe("account-main");
  });

  it("rifiuta saldi iniziali in valuta diversa", () => {
    expect(() =>
      Account.create({
        id: "account-main",
        name: "Conto Demo",
        type: "checking",
        currency: "EUR",
        openingBalance: Money.fromMinor(100n, "USD"),
      }),
    ).toThrowError(DomainError);
  });

  it("aggiorna soltanto i campi mutabili mantenendo l'identità contabile", () => {
    const account = Account.create({
      id: "account-main",
      name: "Conto Demo",
      type: "checking",
      institution: "Banca Demo",
      currency: "EUR",
      openingBalance: Money.fromMinor(10_000n, "EUR"),
    });

    const updated = account.update({
      name: "Conto aggiornato",
      institution: null,
      openingBalance: Money.fromMinor(12_500n, "EUR"),
      isArchived: true,
    });

    expect(updated).toMatchObject({
      id: account.id,
      name: "Conto aggiornato",
      type: account.type,
      currency: account.currency,
      institution: undefined,
      parentAccountId: undefined,
      isArchived: true,
    });
    expect(updated.openingBalance.amountMinor).toBe(12_500n);
  });
});
