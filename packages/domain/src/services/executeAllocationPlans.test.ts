import { describe, expect, it } from "vitest";
import { Account } from "../entities/Account";
import { AllocationPlan } from "../entities/AllocationPlan";
import type { LedgerRepository, TransferBundle } from "../repositories/LedgerRepository";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { executeConfirmedAllocationPlans } from "./executeAllocationPlans";

describe("executeConfirmedAllocationPlans", () => {
  it("crea solo trasferimenti confermati e bilanciati", async () => {
    const accounts = new Map<string, Account>([
      [
        "source",
        Account.create({ id: "source", name: "Origine", type: "checking", currency: "EUR" }),
      ],
      [
        "target",
        Account.create({ id: "target", name: "Destinazione", type: "savings", currency: "EUR" }),
      ],
    ]);
    const bundles: TransferBundle[] = [];
    const repository = {
      findAccountById: async (id: string) => accounts.get(id),
      saveTransfer: async (bundle: TransferBundle) => {
        bundles.push(bundle);
      },
    } as unknown as LedgerRepository;
    const plan = AllocationPlan.create({
      id: "plan",
      name: "Risparmio",
      trigger: "salary",
      sourceAccountId: "source",
      targetAccountId: "target",
      amount: Money.fromMinor(17_000n, "EUR"),
    });
    await executeConfirmedAllocationPlans(
      repository,
      [plan],
      LocalDate.parse("2026-07-28"),
      (() => "id") as () => string,
    );
    expect(bundles).toHaveLength(1);
    expect(bundles[0]!.debitTransaction.amount.amountMinor).toBe(-17_000n);
    expect(bundles[0]!.creditTransaction.amount.amountMinor).toBe(17_000n);
  });
});
