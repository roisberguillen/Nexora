import { Account, Money } from "@nexora/domain";
import { InMemoryLedgerRepository } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { createLoan, deleteLoan, updateLoan } from "./loanCommands";

describe("loan commands", () => {
  it("creates, updates and deletes only the loan record", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "loan-account",
      name: "Prestito",
      type: "loan",
      currency: "EUR",
    });
    await repository.saveAccount(account);
    const loan = await createLoan(
      repository,
      {
        accountId: account.id,
        lender: "Finanziaria demo",
        installmentMinor: 17_200n,
        remainingPrincipalMinor: 500_000n,
        originalPrincipalMinor: 1_000_000n,
        annualNominalRateBps: 499,
        installmentsPaid: 4,
      },
      () => "loan-1",
    );

    await updateLoan(repository, loan.id, {
      accountId: account.id,
      lender: "Istituto demo",
      installmentMinor: 18_000n,
      remainingPrincipalMinor: 450_000n,
      originalPrincipalMinor: 1_000_000n,
      annualEffectiveRateBps: 610,
      installmentsRemaining: 12,
      nextDueDate: "2026-09-01",
    });
    expect(await repository.listLoans()).toMatchObject([
      { lender: "Istituto demo", annualEffectiveRateBps: 610, installmentsRemaining: 12 },
    ]);
    await deleteLoan(repository, loan.id);
    await expect(repository.listLoans()).resolves.toEqual([]);
    await expect(repository.findAccountById(account.id)).resolves.toEqual(account);
  });

  it("keeps the account currency as the authoritative money currency", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "loan-account",
        name: "Prestito",
        type: "loan",
        currency: "EUR",
        openingBalance: Money.zero("EUR"),
      }),
    );
    const loan = await createLoan(
      repository,
      {
        accountId: "loan-account",
        lender: "Banca",
        installmentMinor: 100n,
        remainingPrincipalMinor: 100n,
      },
      () => "loan-2",
    );
    expect(loan.installment.currency).toBe("EUR");
  });
});
