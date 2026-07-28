import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";
import { Money } from "../value-objects/Money";

export type AllocationTrigger = "salary" | "photo_income";
export interface CreateAllocationPlanProps {
  readonly id: string;
  readonly name: string;
  readonly trigger: AllocationTrigger;
  readonly sourceAccountId: string;
  readonly targetAccountId: string;
  readonly amount: Money;
  readonly enabled?: boolean;
}
export class AllocationPlan {
  public readonly id: string;
  public readonly name: string;
  public readonly trigger: AllocationTrigger;
  public readonly sourceAccountId: string;
  public readonly targetAccountId: string;
  public readonly amount: Money;
  public readonly enabled: boolean;
  private constructor(props: CreateAllocationPlanProps) {
    this.id = requireIdentifier(props.id, "Allocation plan id");
    this.name = requireName(props.name);
    this.trigger = props.trigger;
    this.sourceAccountId = requireIdentifier(props.sourceAccountId, "Allocation source account id");
    this.targetAccountId = requireIdentifier(props.targetAccountId, "Allocation target account id");
    this.amount = props.amount;
    this.enabled = props.enabled ?? true;
    if (this.trigger !== "salary" && this.trigger !== "photo_income")
      throw new DomainError("invalid_transaction", "Allocation trigger is invalid.");
    if (this.sourceAccountId === this.targetAccountId)
      throw new DomainError("invalid_transfer", "Allocation accounts must be distinct.");
    if (!this.amount.isPositive())
      throw new DomainError("invalid_money", "Allocation amount must be positive.");
    Object.freeze(this);
  }
  public static create(props: CreateAllocationPlanProps): AllocationPlan {
    return new AllocationPlan(props);
  }
}
function requireName(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 120)
    throw new DomainError("invalid_identifier", "Allocation plan name is invalid.");
  return normalized;
}
