import { InMemoryLedgerRepository } from "@nexora/database";
import { Account, LocalDate, Money, Transaction } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import {
  createLedgerAccount,
  formatEditableAmountMinor,
  parseLocalizedAmountMinor,
  setLedgerAccountArchived,
  updateLedgerAccount,
} from "./accountCommands";

describe("account commands", () => {
  it("converte importi localizzati in minor units senza floating point", () => {
    expect(() => parseLocalizedAmountMinor("1.234,56", "EUR")).toThrow();
    expect(parseLocalizedAmountMinor("1234,56", "EUR")).toBe(123_456n);
    expect(parseLocalizedAmountMinor("-0,09", "EUR")).toBe(-9n);
    expect(parseLocalizedAmountMinor("90071992547409931234567890,12", "EUR")).toBe(
      9007199254740993123456789012n,
    );
    expect(formatEditableAmountMinor(-9n, "EUR")).toBe("-0,09");
    expect(formatEditableAmountMinor(1234n, "JPY")).toBe("1234");
  });

  it("rifiuta una precisione superiore a quella della valuta", () => {
    expect(() => parseLocalizedAmountMinor("10,001", "EUR")).toThrowError(/2 decimali/);
    expect(() => parseLocalizedAmountMinor("10,1", "JPY")).toThrowError(/0 decimali/);
  });

  it("crea, aggiorna e archivia un conto attraverso il repository", async () => {
    const repository = new InMemoryLedgerRepository();
    const created = await createLedgerAccount(
      repository,
      {
        currency: "eur",
        institution: "Istituto demo",
        name: "Conto demo",
        openingBalanceMinor: 12_345n,
        type: "checking",
      },
      () => "account-demo",
    );

    expect(created.currency).toBe("EUR");
    await updateLedgerAccount(repository, created.id, {
      institution: "",
      name: "Conto aggiornato",
      openingBalanceMinor: 15_000n,
    });
    await setLedgerAccountArchived(repository, created.id, true);

    await expect(repository.findAccountById(created.id)).resolves.toMatchObject({
      institution: undefined,
      isArchived: true,
      name: "Conto aggiornato",
    });
  });

  it("non modifica il saldo iniziale dopo il primo movimento", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "account-demo",
      name: "Conto demo",
      type: "checking",
      currency: "EUR",
      openingBalance: Money.fromMinor(10_000n, "EUR"),
    });
    await repository.saveAccount(account);
    await repository.saveTransaction(
      Transaction.create({
        id: "transaction-demo",
        kind: "income",
        status: "booked",
        accountId: account.id,
        amount: Money.fromMinor(100n, "EUR"),
        bookedDate: LocalDate.parse("2026-07-28"),
      }),
    );

    await expect(
      updateLedgerAccount(repository, account.id, {
        institution: "",
        name: "Conto demo",
        openingBalanceMinor: 12_000n,
      }),
    ).rejects.toMatchObject({ code: "invalid_account" });
  });
});
