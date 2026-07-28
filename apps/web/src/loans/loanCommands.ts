import { Loan, LocalDate, Money, type LedgerRepository } from "@nexora/domain";

export interface LoanInput {
  readonly accountId: string;
  readonly installmentMinor: bigint;
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
  const loan = Loan.create({
    id: idFactory(),
    accountId: input.accountId,
    lender: input.lender,
    installment: Money.fromMinor(input.installmentMinor, account.currency),
    remainingPrincipal: Money.fromMinor(input.remainingPrincipalMinor, account.currency),
    ...(input.originalPrincipalMinor === undefined
      ? {}
      : { originalPrincipal: Money.fromMinor(input.originalPrincipalMinor, account.currency) }),
    ...(input.nextDueDate === undefined ? {} : { nextDueDate: LocalDate.parse(input.nextDueDate) }),
  });
  await repository.saveLoan(loan);
  return loan;
}
