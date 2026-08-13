import {
  InvestmentPosition,
  LocalDate,
  Money,
  type Account,
  type LedgerRepository,
} from "@nexora/domain";
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
  const position = positionFromInput(idFactory(), input, account.currency);
  await repository.saveInvestmentPosition(position);
  return position;
}

export async function updateInvestmentPosition(
  repository: LedgerRepository,
  id: string,
  input: InvestmentPositionInput,
): Promise<InvestmentPosition> {
  const existing = (await repository.listInvestmentPositions()).find(
    (position) => position.id === id,
  );
  if (existing === undefined) throw new Error("missing_investment_position");
  const account = await repository.findAccountById(input.accountId);
  if (account === undefined) throw new Error("missing_account");
  const position = positionFromInput(existing.id, input, account.currency);
  await repository.updateInvestmentPosition(position);
  return position;
}

export async function deleteInvestmentPosition(
  repository: LedgerRepository,
  id: string,
): Promise<void> {
  await repository.deleteInvestmentPosition(id);
}

function positionFromInput(
  id: string,
  input: InvestmentPositionInput,
  currency: Account["currency"],
): InvestmentPosition {
  return InvestmentPosition.create({
    id,
    accountId: input.accountId,
    name: input.name,
    costBasis: Money.fromMinor(input.costBasisMinor, currency),
    currentValue: Money.fromMinor(input.currentValueMinor, currency),
    valuationDate: LocalDate.parse(input.valuationDate),
    ...(input.symbol === undefined ? {} : { symbol: input.symbol }),
  });
}
