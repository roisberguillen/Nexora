import { DomainError } from "../errors/DomainError";
import type { AllocationPlan } from "../entities/AllocationPlan";
import { Transaction } from "../entities/Transaction";
import { Transfer } from "../entities/Transfer";
import type { LedgerRepository } from "../repositories/LedgerRepository";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";

export interface AllocationExecutionReceipt {
  readonly alreadyExecutedPlanIds: readonly string[];
  readonly executedPlanIds: readonly string[];
}

export function allocationExecutionMarker(executionId: string, planId: string): string {
  return `nexora-allocation:${executionId}:${planId}`;
}

export async function executeConfirmedAllocationPlans(
  repository: LedgerRepository,
  plans: readonly AllocationPlan[],
  bookedDate: LocalDate,
  executionId: string,
): Promise<AllocationExecutionReceipt> {
  const existingMarkers = new Set(
    (await repository.listTransactions())
      .map((transaction) => transaction.note)
      .filter(
        (note): note is string => note !== undefined && note.startsWith("nexora-allocation:"),
      ),
  );
  const executedPlanIds: string[] = [];
  const alreadyExecutedPlanIds: string[] = [];
  for (const plan of plans.filter((candidate) => candidate.enabled)) {
    const marker = allocationExecutionMarker(executionId, plan.id);
    if (existingMarkers.has(marker)) {
      alreadyExecutedPlanIds.push(plan.id);
      continue;
    }
    const [source, target] = await Promise.all([
      repository.findAccountById(plan.sourceAccountId),
      repository.findAccountById(plan.targetAccountId),
    ]);
    if (source === undefined || target === undefined || source.isArchived || target.isArchived)
      throw new DomainError("missing_reference", "Allocation accounts are not available.");
    if (source.currency !== target.currency || source.currency !== plan.amount.currency)
      throw new DomainError("currency_mismatch", "Allocation accounts must share a currency.");
    const debitTransaction = Transaction.create({
      id: `allocation-debit-${executionId}-${plan.id}`,
      kind: "transfer",
      status: "booked",
      accountId: source.id,
      amount: Money.fromMinor(-plan.amount.amountMinor, plan.amount.currency),
      bookedDate,
      source: "system",
      note: marker,
    });
    const creditTransaction = Transaction.create({
      id: `allocation-credit-${executionId}-${plan.id}`,
      kind: "transfer",
      status: "booked",
      accountId: target.id,
      amount: plan.amount,
      bookedDate,
      source: "system",
      note: marker,
    });
    const transfer = Transfer.create({
      id: `allocation-transfer-${executionId}-${plan.id}`,
      debitTransaction,
      creditTransaction,
    });
    try {
      await repository.saveTransfer({ transfer, debitTransaction, creditTransaction });
      executedPlanIds.push(plan.id);
    } catch (cause) {
      const markerWasPersisted = (await repository.listTransactions()).some(
        (transaction) => transaction.note === marker,
      );
      if (!markerWasPersisted) throw cause;
      alreadyExecutedPlanIds.push(plan.id);
    }
  }
  return { executedPlanIds, alreadyExecutedPlanIds };
}
