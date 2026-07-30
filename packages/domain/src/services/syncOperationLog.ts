export interface SyncOperation {
  readonly idempotencyKey: string;
  readonly entityId: string;
  readonly baseRevision: number;
  readonly payloadDigest: string;
  readonly createdAt: string;
}

export type SyncApplyResult =
  | { readonly status: "applied"; readonly cursor: number; readonly revision: number }
  | { readonly status: "duplicate"; readonly cursor: number; readonly revision: number }
  | { readonly status: "conflict"; readonly currentRevision: number };

/** In-memory contract model for adapters: retries are idempotent and stale writes never overwrite. */
export class SyncOperationLog {
  private readonly keys = new Map<string, { cursor: number; revision: number }>();
  private readonly revisions = new Map<string, number>();
  private cursor = 0;
  private readonly operations: Array<{ cursor: number; operation: SyncOperation; revision: number }> = [];

  public apply(operation: SyncOperation): SyncApplyResult {
    const previous = this.keys.get(operation.idempotencyKey);
    if (previous !== undefined) return { status: "duplicate", ...previous };
    const currentRevision = this.revisions.get(operation.entityId) ?? 0;
    if (operation.baseRevision !== currentRevision) return { status: "conflict", currentRevision };
    const revision = currentRevision + 1;
    const cursor = ++this.cursor;
    this.revisions.set(operation.entityId, revision);
    this.keys.set(operation.idempotencyKey, { cursor, revision });
    this.operations.push({ cursor, operation, revision });
    return { status: "applied", cursor, revision };
  }

  public after(cursor: number): ReadonlyArray<{ readonly cursor: number; readonly operation: SyncOperation; readonly revision: number }> {
    return this.operations.filter((entry) => entry.cursor > cursor);
  }
}
