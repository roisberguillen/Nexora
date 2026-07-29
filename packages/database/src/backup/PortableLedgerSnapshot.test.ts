import { Account, Money } from "@nexora/domain";
import { describe, expect, it } from "vitest";
import {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  validatePortableLedgerSnapshot,
} from "./PortableLedgerSnapshot";
import { InMemoryLedgerRepository } from "../in-memory/InMemoryLedgerRepository";

describe("portable ledger snapshot", () => {
  it("serializes monetary values without lossy floating-point conversion", async () => {
    const repository = new InMemoryLedgerRepository();
    await repository.saveAccount(
      Account.create({
        id: "account-1",
        name: "Conto",
        type: "checking",
        currency: "EUR",
        openingBalance: Money.fromMinor(9_007_199_254_740_993n, "EUR"),
      }),
    );
    const snapshot = decodePortableLedgerSnapshot(
      encodePortableLedgerSnapshot(await capturePortableLedgerSnapshot(repository)),
    );
    const account = snapshot.entities.accounts?.[0] as {
      readonly openingBalance: { readonly amountMinor: string };
    };
    expect(account.openingBalance.amountMinor).toBe("9007199254740993");
    expect(validatePortableLedgerSnapshot(snapshot).accounts[0]?.openingBalance.amountMinor).toBe(
      9_007_199_254_740_993n,
    );
  });
});
