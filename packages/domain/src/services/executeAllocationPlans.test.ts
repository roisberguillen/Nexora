import { describe, expect, it } from "vitest";
import { Account } from "../entities/Account";
import { AllocationPlan } from "../entities/AllocationPlan";
import { DomainError } from "../errors/DomainError";
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
      listTransactions: async () => [],
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
      "execution-1",
    );
    expect(bundles).toHaveLength(1);
    expect(bundles[0]!.debitTransaction.amount.amountMinor).toBe(-17_000n);
    expect(bundles[0]!.creditTransaction.amount.amountMinor).toBe(17_000n);
  });

  it("does not duplicate a plan when the same execution is retried", async () => {
    const source = Account.create({
      id: "source",
      name: "Origine",
      type: "checking",
      currency: "EUR",
    });
    const target = Account.create({
      id: "target",
      name: "Destinazione",
      type: "savings",
      currency: "EUR",
    });
    const plan = AllocationPlan.create({
      id: "plan",
      name: "Risparmio",
      trigger: "salary",
      sourceAccountId: source.id,
      targetAccountId: target.id,
      amount: Money.fromMinor(10_000n, "EUR"),
    });
    const bundles: TransferBundle[] = [];
    const repository = {
      findAccountById: async (id: string) => (id === source.id ? source : target),
      listTransactions: async () =>
        bundles.flatMap((bundle) => [bundle.debitTransaction, bundle.creditTransaction]),
      saveTransfer: async (bundle: TransferBundle) => {
        bundles.push(bundle);
      },
    } as unknown as LedgerRepository;

    await executeConfirmedAllocationPlans(
      repository,
      [plan],
      LocalDate.parse("2026-07-28"),
      "income-1",
    );
    const receipt = await executeConfirmedAllocationPlans(
      repository,
      [plan],
      LocalDate.parse("2026-07-28"),
      "income-1",
    );

    expect(bundles).toHaveLength(1);
    expect(receipt).toEqual({ executedPlanIds: [], alreadyExecutedPlanIds: [plan.id] });
  });

  it("retries only the plan not persisted after a sequential batch failure", async () => {
    const source = Account.create({
      id: "source",
      name: "Origine",
      type: "checking",
      currency: "EUR",
    });
    const target = Account.create({
      id: "target",
      name: "Destinazione",
      type: "savings",
      currency: "EUR",
    });
    const plans = ["first", "second"].map((id) =>
      AllocationPlan.create({
        id,
        name: id,
        trigger: "salary",
        sourceAccountId: source.id,
        targetAccountId: target.id,
        amount: Money.fromMinor(10_000n, "EUR"),
      }),
    );
    const bundles: TransferBundle[] = [];
    let attempts = 0;
    const repository = {
      findAccountById: async (id: string) => (id === source.id ? source : target),
      listTransactions: async () =>
        bundles.flatMap((bundle) => [bundle.debitTransaction, bundle.creditTransaction]),
      saveTransfer: async (bundle: TransferBundle) => {
        attempts += 1;
        if (attempts === 2) throw new Error("simulated write failure");
        bundles.push(bundle);
      },
    } as unknown as LedgerRepository;

    await expect(
      executeConfirmedAllocationPlans(repository, plans, LocalDate.parse("2026-07-28"), "income-2"),
    ).rejects.toThrow("simulated write failure");
    const receipt = await executeConfirmedAllocationPlans(
      repository,
      plans,
      LocalDate.parse("2026-07-28"),
      "income-2",
    );

    expect(bundles).toHaveLength(2);
    expect(receipt).toEqual({
      executedPlanIds: ["second"],
      alreadyExecutedPlanIds: ["first"],
    });
  });

  it("keeps one transfer when the same execution is confirmed concurrently", async () => {
    const source = Account.create({
      id: "source",
      name: "Origine",
      type: "checking",
      currency: "EUR",
    });
    const target = Account.create({
      id: "target",
      name: "Destinazione",
      type: "savings",
      currency: "EUR",
    });
    const plan = AllocationPlan.create({
      id: "plan",
      name: "Risparmio",
      trigger: "salary",
      sourceAccountId: source.id,
      targetAccountId: target.id,
      amount: Money.fromMinor(10_000n, "EUR"),
    });
    const bundles = new Map<string, TransferBundle>();
    const repository = {
      findAccountById: async (id: string) => (id === source.id ? source : target),
      listTransactions: async () =>
        [...bundles.values()].flatMap((bundle) => [
          bundle.debitTransaction,
          bundle.creditTransaction,
        ]),
      saveTransfer: async (bundle: TransferBundle) => {
        await Promise.resolve();
        if (bundles.has(bundle.transfer.id))
          throw new DomainError("duplicate_entity", "Transfer already exists.");
        bundles.set(bundle.transfer.id, bundle);
      },
    } as unknown as LedgerRepository;

    const receipts = await Promise.all(
      [1, 2].map(() =>
        executeConfirmedAllocationPlans(
          repository,
          [plan],
          LocalDate.parse("2026-07-28"),
          "income-concurrent",
        ),
      ),
    );

    expect(bundles.size).toBe(1);
    expect(receipts.flatMap((receipt) => receipt.executedPlanIds)).toHaveLength(1);
    expect(receipts.flatMap((receipt) => receipt.alreadyExecutedPlanIds)).toEqual([plan.id]);
  });
});
