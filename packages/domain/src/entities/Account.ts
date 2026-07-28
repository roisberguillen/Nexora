import { DomainError } from "../errors/DomainError";
import { normalizeOptionalText, requireIdentifier, requireName } from "../validation";
import { currencyCode, type CurrencyCode } from "../value-objects/CurrencyCode";
import { Money } from "../value-objects/Money";

export type AccountType =
  "checking" | "savings" | "cash" | "investment" | "loan" | "virtual_subaccount";

const accountTypes = new Set<AccountType>([
  "checking",
  "savings",
  "cash",
  "investment",
  "loan",
  "virtual_subaccount",
]);

export interface CreateAccountProps {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: string;
  readonly institution?: string;
  readonly parentAccountId?: string;
  readonly openingBalance?: Money;
  readonly isArchived?: boolean;
}

export interface UpdateAccountProps {
  readonly name?: string;
  readonly institution?: string | null;
  readonly openingBalance?: Money;
  readonly isArchived?: boolean;
}

export class Account {
  public readonly id: string;
  public readonly name: string;
  public readonly type: AccountType;
  public readonly currency: CurrencyCode;
  public readonly institution: string | undefined;
  public readonly parentAccountId: string | undefined;
  public readonly openingBalance: Money;
  public readonly isArchived: boolean;

  private constructor(props: CreateAccountProps) {
    this.id = requireIdentifier(props.id, "Account id");
    this.name = requireName(props.name, "Account name", "invalid_account");
    if (!accountTypes.has(props.type)) {
      throw new DomainError("invalid_account", "Account type is not supported.");
    }
    this.type = props.type;
    this.currency = currencyCode(props.currency);
    this.institution = normalizeOptionalText(props.institution, 160, "invalid_account");
    this.parentAccountId =
      props.parentAccountId === undefined
        ? undefined
        : requireIdentifier(props.parentAccountId, "Parent account id");
    this.openingBalance = props.openingBalance ?? Money.zero(this.currency);
    this.isArchived = props.isArchived ?? false;

    if (this.openingBalance.currency !== this.currency) {
      throw new DomainError(
        "currency_mismatch",
        "Account opening balance must use the account currency.",
      );
    }
    if (this.type === "virtual_subaccount" && this.parentAccountId === undefined) {
      throw new DomainError("invalid_account", "Virtual subaccounts require a parent account.");
    }
    if (this.type !== "virtual_subaccount" && this.parentAccountId !== undefined) {
      throw new DomainError(
        "invalid_account",
        "Only virtual subaccounts may reference a parent account.",
      );
    }
    if (this.parentAccountId === this.id) {
      throw new DomainError("invalid_account", "An account cannot be its own parent.");
    }

    Object.freeze(this);
  }

  public static create(props: CreateAccountProps): Account {
    return new Account(props);
  }

  public update(props: UpdateAccountProps): Account {
    const institution =
      "institution" in props ? (props.institution ?? undefined) : this.institution;

    return Account.create({
      id: this.id,
      name: props.name ?? this.name,
      type: this.type,
      currency: this.currency,
      openingBalance: props.openingBalance ?? this.openingBalance,
      isArchived: props.isArchived ?? this.isArchived,
      ...(institution === undefined ? {} : { institution }),
      ...(this.parentAccountId === undefined ? {} : { parentAccountId: this.parentAccountId }),
    });
  }
}
