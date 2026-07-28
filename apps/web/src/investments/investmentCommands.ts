import { InvestmentPosition, LocalDate, Money, type LedgerRepository } from "@nexora/domain";
export interface InvestmentPositionInput {
  readonly accountId: string;
  readonly name: string;
  readonly costBasisMinor: bigint;
  readonly currentValueMinor: bigint;
  readonly valuationDate: string;
  readonly symbol?: string;
}
export async function createInvestmentPosition(
  repository: LedgerRepository,
  input: InvestmentPositionInput,
  idFactory: () => string = () => `position-${crypto.randomUUID()}`,
): Promise<InvestmentPosition> {
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const position = InvestmentPosition.create({
    id: idFactory(),
    accountId: input.accountId,
    name: input.name,
    costBasis: Money.fromMinor(input.costBasisMinor, account.currency),
    currentValue: Money.fromMinor(input.currentValueMinor, account.currency),
    valuationDate: LocalDate.parse(input.valuationDate),
    ...(input.symbol === undefined ? {} : { symbol: input.symbol }),
  });
  await repository.saveInvestmentPosition(position);
  return position;
}
