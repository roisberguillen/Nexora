import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";
import type { ImportRowStatus } from "./ImportBatch";

export interface CreateImportRowProps {
  readonly id: string;
  readonly batchId: string;
  readonly rowNumber: number;
  readonly rawJson: string;
  readonly normalizedJson?: string;
  readonly status: ImportRowStatus;
  readonly errorCode?: string;
  readonly createdTransactionId?: string;
}
export class ImportRow {
  public readonly id: string;
  public readonly batchId: string;
  public readonly rowNumber: number;
  public readonly rawJson: string;
  public readonly normalizedJson: string | undefined;
  public readonly status: ImportRowStatus;
  public readonly errorCode: string | undefined;
  public readonly createdTransactionId: string | undefined;
  private constructor(props: CreateImportRowProps) {
    this.id = requireIdentifier(props.id, "Import row id");
    this.batchId = requireIdentifier(props.batchId, "Import row batch id");
    if (!Number.isInteger(props.rowNumber) || props.rowNumber < 1)
      throw new DomainError("invalid_import", "Import row number is invalid.");
    this.rowNumber = props.rowNumber;
    this.rawJson = requireJson(props.rawJson);
    this.normalizedJson =
      props.normalizedJson === undefined ? undefined : requireJson(props.normalizedJson);
    this.status = props.status;
    this.errorCode = props.errorCode?.trim() || undefined;
    this.createdTransactionId =
      props.createdTransactionId === undefined
        ? undefined
        : requireIdentifier(props.createdTransactionId, "Created transaction id");
    if ((this.status === "imported") !== (this.createdTransactionId !== undefined))
      throw new DomainError(
        "invalid_import",
        "Imported rows must match their transaction reference.",
      );
    Object.freeze(this);
  }
  public static create(props: CreateImportRowProps): ImportRow {
    return new ImportRow(props);
  }
}
function requireJson(value: string): string {
  try {
    JSON.parse(value);
  } catch {
    throw new DomainError("invalid_import", "Import row payload must be JSON.");
  }
  return value;
}
