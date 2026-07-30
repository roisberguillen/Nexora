import { DatabaseSync } from "node:sqlite";
import type { SyncApplyResult, SyncOperation, SyncOperationStore } from "@nexora/domain";

/** Durable host-side operation log. The host, not browser storage, owns this sync metadata. */
export class SqliteSyncOperationStore implements SyncOperationStore {
  private readonly database: DatabaseSync;
  public constructor(filename: string) {
    this.database = new DatabaseSync(filename);
    this.database.exec("CREATE TABLE IF NOT EXISTS sync_operations (cursor INTEGER PRIMARY KEY AUTOINCREMENT, idempotency_key TEXT NOT NULL UNIQUE, entity_id TEXT NOT NULL, base_revision INTEGER NOT NULL, payload_digest TEXT NOT NULL, created_at TEXT NOT NULL, revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sync_revisions (entity_id TEXT PRIMARY KEY, revision INTEGER NOT NULL);");
  }
  public apply(operation: SyncOperation): SyncApplyResult {
    const duplicate = this.database.prepare("SELECT cursor, revision FROM sync_operations WHERE idempotency_key = ?").get(operation.idempotencyKey) as { cursor: number; revision: number } | undefined;
    if (duplicate !== undefined) return { status: "duplicate", cursor: duplicate.cursor, revision: duplicate.revision };
    const current = (this.database.prepare("SELECT revision FROM sync_revisions WHERE entity_id = ?").get(operation.entityId) as { revision: number } | undefined)?.revision ?? 0;
    if (current !== operation.baseRevision) return { status: "conflict", currentRevision: current };
    const revision = current + 1;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.prepare("INSERT INTO sync_operations (idempotency_key, entity_id, base_revision, payload_digest, created_at, revision) VALUES (?, ?, ?, ?, ?, ?)").run(operation.idempotencyKey, operation.entityId, operation.baseRevision, operation.payloadDigest, operation.createdAt, revision);
      this.database.prepare("INSERT INTO sync_revisions (entity_id, revision) VALUES (?, ?) ON CONFLICT(entity_id) DO UPDATE SET revision = excluded.revision").run(operation.entityId, revision);
      const cursor = (this.database.prepare("SELECT last_insert_rowid() AS cursor").get() as { cursor: number }).cursor;
      this.database.exec("COMMIT");
      return { status: "applied", cursor, revision };
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  public after(cursor: number) {
    return (this.database.prepare("SELECT cursor, idempotency_key, entity_id, base_revision, payload_digest, created_at, revision FROM sync_operations WHERE cursor > ? ORDER BY cursor").all(cursor) as Array<{ cursor: number; idempotency_key: string; entity_id: string; base_revision: number; payload_digest: string; created_at: string; revision: number }>).map((row) => ({ cursor: row.cursor, revision: row.revision, operation: { idempotencyKey: row.idempotency_key, entityId: row.entity_id, baseRevision: row.base_revision, payloadDigest: row.payload_digest, createdAt: row.created_at } }));
  }
  public close(): void { this.database.close(); }
}
