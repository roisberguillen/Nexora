import { DomainError } from "../errors/DomainError";
import { requireIdentifier } from "../validation";

export type ImportBatchStatus = "previewed" | "committed" | "undone" | "failed";
export type ImportRowStatus = "imported" | "skipped_duplicate" | "needs_review" | "failed";

export interface CreateImportBatchProps {
  readonly id: string;
  readonly importerType: "money_manager_xlsx";
  readonly sourceFilename: string;
  readonly sourceSha256: string;
  readonly status?: ImportBatchStatus;
  readonly rowsTotal: number;
  readonly rowsImported?: number;
  readonly rowsSkipped?: number;
  readonly rowsFailed?: number;
}

export class ImportBatch {
  public readonly id: string;
  public readonly importerType: "money_manager_xlsx";
  public readonly sourceFilename: string;
  public readonly sourceSha256: string;
  public readonly status: ImportBatchStatus;
  public readonly rowsTotal: number;
  public readonly rowsImported: number;
  public readonly rowsSkipped: number;
  public readonly rowsFailed: number;

  private constructor(props: CreateImportBatchProps) {
    this.id = requireIdentifier(props.id, "Import batch id");
    this.importerType = props.importerType;
    this.sourceFilename = requireText(props.sourceFilename, 500, "Source filename");
    this.sourceSha256 = requireSha256(props.sourceSha256);
    this.status = props.status ?? "previewed";
    this.rowsTotal = requireCount(props.rowsTotal, "Rows total");
    this.rowsImported = requireCount(props.rowsImported ?? 0, "Rows imported");
    this.rowsSkipped = requireCount(props.rowsSkipped ?? 0, "Rows skipped");
    this.rowsFailed = requireCount(props.rowsFailed ?? 0, "Rows failed");
    if (this.rowsImported + this.rowsSkipped + this.rowsFailed > this.rowsTotal) {
      throw new DomainError("invalid_import", "Import batch row counts exceed the total.");
    }
    Object.freeze(this);
  }

  public static create(props: CreateImportBatchProps): ImportBatch {
    return new ImportBatch(props);
  }

  public commit(
    counts: Pick<CreateImportBatchProps, "rowsImported" | "rowsSkipped" | "rowsFailed">,
  ): ImportBatch {
    if (this.status !== "previewed")
      throw new DomainError("invalid_import", "Only previewed batches can be committed.");
    return ImportBatch.create({ ...this, ...counts, status: "committed" });
  }

  public undo(): ImportBatch {
    if (this.status !== "committed")
      throw new DomainError("invalid_import", "Only committed batches can be undone.");
    return ImportBatch.create({ ...this, status: "undone" });
  }
}

function requireText(value: string, maximum: number, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum)
    throw new DomainError("invalid_import", `${label} is invalid.`);
  return normalized;
}
function requireSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized))
    throw new DomainError("invalid_import", "Source SHA-256 is invalid.");
  return normalized;
}
function requireCount(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0)
    throw new DomainError("invalid_import", `${label} must be a non-negative integer.`);
  return value;
}
