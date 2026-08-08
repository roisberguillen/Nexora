import { DomainError } from "../errors/DomainError";
import { normalizeOptionalText, requireIdentifier } from "../validation";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";

export type TransactionKind = "income" | "expense" | "transfer" | "adjustment";
export type TransactionStatus = "expected" | "booked" | "reconciled" | "cancelled";
export type TransactionSource = "manual" | "import" | "recurring" | "system";
export type ExpenseVariability = "fixed" | "variable";
export type ExpenseExceptionality = "ordinary" | "extraordinary";

const transactionKinds = new Set<TransactionKind>(["income", "expense", "transfer", "adjustment"]);
const transactionStatuses = new Set<TransactionStatus>([
  "expected",
  "booked",
  "reconciled",
  "cancelled",
]);
const transactionSources = new Set<TransactionSource>(["manual", "import", "recurring", "system"]);
const expenseVariabilities = new Set<ExpenseVariability>(["fixed", "variable"]);
const expenseExceptionalities = new Set<ExpenseExceptionality>(["ordinary", "extraordinary"]);

export interface CreateTransactionProps {
  readonly id: string;
  readonly kind: TransactionKind;
  readonly status: TransactionStatus;
  readonly accountId: string;
  readonly amount: Money;
  readonly bookedDate: LocalDate;
  readonly valueDate?: LocalDate;
  readonly payee?: string;
  readonly description?: string;
  readonly categoryId?: string;
  readonly note?: string;
  readonly source?: TransactionSource;
  readonly importBatchId?: string;
  readonly sourceFingerprint?: string;
  readonly expenseVariability?: ExpenseVariability;
  readonly expenseExceptionality?: ExpenseExceptionality;
}

export class Transaction {
  public readonly id: string;
  public readonly kind: TransactionKind;
  public readonly status: TransactionStatus;
  public readonly accountId: string;
  public readonly amount: Money;
  public readonly bookedDate: LocalDate;
  public readonly valueDate: LocalDate | undefined;
  public readonly payee: string | undefined;
  public readonly description: string | undefined;
  public readonly categoryId: string | undefined;
  public readonly note: string | undefined;
  public readonly source: TransactionSource;
  public readonly importBatchId: string | undefined;
  public readonly sourceFingerprint: string | undefined;
  public readonly expenseVariability: ExpenseVariability | undefined;
  public readonly expenseExceptionality: ExpenseExceptionality | undefined;

  private constructor(props: CreateTransactionProps) {
    this.id = requireIdentifier(props.id, "Transaction id");
    if (!transactionKinds.has(props.kind) || !transactionStatuses.has(props.status)) {
      throw new DomainError("invalid_transaction", "Transaction kind or status is not supported.");
    }
    this.kind = props.kind;
    this.status = props.status;
    this.accountId = requireIdentifier(props.accountId, "Transaction account id");
    this.amount = props.amount;
    this.bookedDate = props.bookedDate;
    this.valueDate = props.valueDate;
    this.payee = normalizeOptionalText(props.payee, 240);
    this.description = normalizeOptionalText(props.description, 500);
    this.categoryId =
      props.categoryId === undefined
        ? undefined
        : requireIdentifier(props.categoryId, "Transaction category id");
    this.note = normalizeOptionalText(props.note, 2_000);
    const source = props.source ?? "manual";
    if (!transactionSources.has(source)) {
      throw new DomainError("invalid_transaction", "Transaction source is not supported.");
    }
    this.source = source;
    this.importBatchId =
      props.importBatchId === undefined
        ? undefined
        : requireIdentifier(props.importBatchId, "Import batch id");
    this.sourceFingerprint = props.sourceFingerprint?.trim().toLowerCase();
    this.expenseVariability = props.expenseVariability;
    this.expenseExceptionality = props.expenseExceptionality;
    if (
      this.source === "import" &&
      (this.importBatchId === undefined || !/^[a-f0-9]{64}$/.test(this.sourceFingerprint ?? ""))
    ) {
      throw new DomainError(
        "invalid_import",
        "Imported transactions require a batch and SHA-256 fingerprint.",
      );
    }
    if (
      this.source !== "import" &&
      (this.importBatchId !== undefined || this.sourceFingerprint !== undefined)
    ) {
      throw new DomainError(
        "invalid_import",
        "Only imported transactions can carry import metadata.",
      );
    }

    this.assertAmountSign();
    if (this.kind === "transfer" && this.categoryId !== undefined) {
      throw new DomainError("invalid_transaction", "Transfer legs cannot have a category.");
    }
    this.assertExpenseBehavior();

    Object.freeze(this);
  }

  public static create(props: CreateTransactionProps): Transaction {
    return new Transaction(props);
  }

  public affectsBalance(): boolean {
    return this.status !== "cancelled";
  }

  public affectsIncomeExpense(): boolean {
    return this.affectsBalance() && (this.kind === "income" || this.kind === "expense");
  }

  public cancel(): Transaction {
    if (this.status === "cancelled") {
      return this;
    }
    if (this.status === "reconciled") {
      throw new DomainError(
        "invalid_transaction",
        "Reconciled transactions must be corrected with an adjustment.",
      );
    }

    return Transaction.create({
      id: this.id,
      kind: this.kind,
      status: "cancelled",
      accountId: this.accountId,
      amount: this.amount,
      bookedDate: this.bookedDate,
      source: this.source,
      ...(this.valueDate === undefined ? {} : { valueDate: this.valueDate }),
      ...(this.payee === undefined ? {} : { payee: this.payee }),
      ...(this.description === undefined ? {} : { description: this.description }),
      ...(this.categoryId === undefined ? {} : { categoryId: this.categoryId }),
      ...(this.note === undefined ? {} : { note: this.note }),
      ...(this.importBatchId === undefined ? {} : { importBatchId: this.importBatchId }),
      ...(this.sourceFingerprint === undefined
        ? {}
        : { sourceFingerprint: this.sourceFingerprint }),
      ...(this.expenseVariability === undefined
        ? {}
        : { expenseVariability: this.expenseVariability }),
      ...(this.expenseExceptionality === undefined
        ? {}
        : { expenseExceptionality: this.expenseExceptionality }),
    });
  }

  private assertExpenseBehavior(): void {
    if (this.kind !== "expense") {
      if (this.expenseVariability !== undefined || this.expenseExceptionality !== undefined) {
        throw new DomainError(
          "invalid_transaction",
          "Expense behavior can only be assigned to expense transactions.",
        );
      }
      return;
    }
    if (
      (this.expenseVariability !== undefined &&
        !expenseVariabilities.has(this.expenseVariability)) ||
      (this.expenseExceptionality !== undefined &&
        !expenseExceptionalities.has(this.expenseExceptionality))
    ) {
      throw new DomainError("invalid_transaction", "Expense behavior is not supported.");
    }
  }

  private assertAmountSign(): void {
    if (this.amount.isZero()) {
      throw new DomainError("invalid_transaction", "Transactions require a non-zero amount.");
    }
    if (this.kind === "income" && !this.amount.isPositive()) {
      throw new DomainError(
        "invalid_transaction",
        "Income transactions require a positive amount.",
      );
    }
    if (this.kind === "expense" && !this.amount.isNegative()) {
      throw new DomainError(
        "invalid_transaction",
        "Expense transactions require a negative amount.",
      );
    }
  }
}
