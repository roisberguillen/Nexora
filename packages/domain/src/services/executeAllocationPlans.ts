import { DomainError } from "../errors/DomainError";
import type { AllocationPlan } from "../entities/AllocationPlan";
import { Transaction } from "../entities/Transaction";
import { Transfer } from "../entities/Transfer";
import type { LedgerRepository } from "../repositories/LedgerRepository";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";

export async function executeConfirmedAllocationPlans(
  repository: LedgerRepository,
  plans: readonly AllocationPlan[],
  bookedDate: LocalDate,
  idFactory: () => string = () => crypto.randomUUID(),
): Promise<void> {
  for (const plan of plans.filter((candidate) => candidate.enabled)) {
    const [source, target] = await Promise.all([
      repository.findAccountById(plan.sourceAccountId),
      repository.findAccountById(plan.targetAccountId),
    ]);
    if (source === undefined || target === undefined || source.isArchived || target.isArchived)
      throw new DomainError("missing_reference", "Allocation accounts are not available.");
    if (source.currency !== target.currency || source.currency !== plan.amount.currency)
      throw new DomainError("currency_mismatch", "Allocation accounts must share a currency.");
    const debitTransaction = Transaction.create({
      id: `allocation-debit-${idFactory()}`,
      kind: "transfer",
      status: "booked",
      accountId: source.id,
      amount: Money.fromMinor(-plan.amount.amountMinor, plan.amount.currency),
      bookedDate,
      source: "system",
      note: `Allocazione confermata: ${plan.name}`,
    });
    const creditTransaction = Transaction.create({
      id: `allocation-credit-${idFactory()}`,
      kind: "transfer",
      status: "booked",
      accountId: target.id,
      amount: plan.amount,
      bookedDate,
      source: "system",
      note: `Allocazione confermata: ${plan.name}`,
    });
    const transfer = Transfer.create({
      id: `allocation-transfer-${idFactory()}`,
      debitTransaction,
      creditTransaction,
    });
    await repository.saveTransfer({ transfer, debitTransaction, creditTransaction });
  }
}
