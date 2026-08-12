import { Loan, LocalDate, Money, type Account, type LedgerRepository } from "@nexora/domain";

export interface LoanInput {
  readonly accountId: string;
  readonly annualEffectiveRateBps?: number;
  readonly annualNominalRateBps?: number;
  readonly installmentMinor: bigint;
  readonly installmentsPaid?: number;
  readonly installmentsRemaining?: number;
  readonly lender: string;
  readonly nextDueDate?: string;
  readonly originalPrincipalMinor?: bigint;
  readonly remainingPrincipalMinor: bigint;
}

export async function createLoan(
  repository: LedgerRepository,
  input: LoanInput,
  idFactory: () => string = () => `loan-${crypto.randomUUID()}`,
): Promise<Loan> {
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const loan = loanFromInput(idFactory(), input, account.currency);
  await repository.saveLoan(loan);
  return loan;
}

export async function updateLoan(
  repository: LedgerRepository,
  id: string,
  input: LoanInput,
): Promise<Loan> {
  const existing = (await repository.listLoans()).find((loan) => loan.id === id);
  if (existing === undefined) throw new Error("missing_loan");
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const loan = loanFromInput(existing.id, input, account.currency);
  await repository.updateLoan(loan);
  return loan;
}

export async function deleteLoan(repository: LedgerRepository, id: string): Promise<void> {
  await repository.deleteLoan(id);
}

function loanFromInput(id: string, input: LoanInput, currency: Account["currency"]): Loan {
  return Loan.create({
    id,
    accountId: input.accountId,
    lender: input.lender,
    installment: Money.fromMinor(input.installmentMinor, currency),
    remainingPrincipal: Money.fromMinor(input.remainingPrincipalMinor, currency),
    ...(input.originalPrincipalMinor === undefined
      ? {}
      : { originalPrincipal: Money.fromMinor(input.originalPrincipalMinor, currency) }),
    ...(input.nextDueDate === undefined ? {} : { nextDueDate: LocalDate.parse(input.nextDueDate) }),
    ...(input.annualNominalRateBps === undefined
      ? {}
      : { annualNominalRateBps: input.annualNominalRateBps }),
    ...(input.annualEffectiveRateBps === undefined
      ? {}
      : { annualEffectiveRateBps: input.annualEffectiveRateBps }),
    ...(input.installmentsPaid === undefined ? {} : { installmentsPaid: input.installmentsPaid }),
    ...(input.installmentsRemaining === undefined
      ? {}
      : { installmentsRemaining: input.installmentsRemaining }),
  });
}
