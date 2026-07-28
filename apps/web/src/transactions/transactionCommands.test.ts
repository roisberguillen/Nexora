import { InMemoryLedgerRepository } from "@nexora/database";
import { Account, LocalDate } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import {
  createManualTransaction,
  createTransfer,
  signedAmountForKind,
} from "./transactionCommands";

describe("transaction commands", () => {
  it("crea una spesa con importo firmato e senza floating point", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("main"));

    const transaction = await createManualTransaction(
      repository,
      {
        accountId: "main",
        amountMinor: signedAmountForKind("expense", 90071992547409931234567890n),
        bookedDate: "2026-07-28",
        description: "Spesa demo",
        kind: "expense",
        payee: "Negozio demo",
        status: "booked",
      },
      () => "expense-demo",
    );

    expect(transaction.amount.amountMinor).toBe(-90071992547409931234567890n);
    await expect(repository.findTransactionById(transaction.id)).resolves.toEqual(transaction);
  });

  it("crea un trasferimento con due gambe opposte e protette", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("source"));
    await repository.saveAccount(account("destination", "savings"));

    const transfer = await createTransfer(
      repository,
      {
        amountMinor: 12_345n,
        bookedDate: "2026-07-28",
        creditAccountId: "destination",
        debitAccountId: "source",
        description: "Accantonamento",
        status: "booked",
      },
      (() => {
        let index = 0;
        return () => `transfer-leg-${++index}`;
      })(),
      () => "transfer-demo",
    );

    expect(transfer.debitTransactionId).toBe("transfer-leg-1");
    expect(
      (await repository.findTransactionById(transfer.debitTransactionId))?.amount.amountMinor,
    ).toBe(-12_345n);
    expect(
      (await repository.findTransactionById(transfer.creditTransactionId))?.amount.amountMinor,
    ).toBe(12_345n);
  });

  it("rifiuta conti uguali e valute diverse per un trasferimento", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(account("eur"));
    await repository.saveAccount(
      Account.create({ id: "usd", name: "Conto USD", type: "savings", currency: "USD" }),
    );

    await expect(
      createTransfer(repository, transferInput({ creditAccountId: "eur", debitAccountId: "eur" })),
    ).rejects.toMatchObject({ code: "invalid_transfer" });
    await expect(
      createTransfer(repository, transferInput({ creditAccountId: "usd", debitAccountId: "eur" })),
    ).rejects.toMatchObject({ code: "currency_mismatch" });
  });
});

function account(id: string, type: "checking" | "savings" = "checking"): Account {
  return Account.create({ id, name: `Conto ${id}`, type, currency: "EUR" });
}

function transferInput(overrides: Partial<{ creditAccountId: string; debitAccountId: string }>) {
  return {
    amountMinor: 100n,
    bookedDate: LocalDate.parse("2026-07-28").value,
    creditAccountId: "destination",
    debitAccountId: "source",
    description: "",
    status: "booked" as const,
    ...overrides,
  };
}
