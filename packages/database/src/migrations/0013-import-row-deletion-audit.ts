import type { DatabaseMigration } from "./DatabaseMigration";
import type { SqliteDatabase } from "../sqlite/SqliteDatabase";

export const IMPORT_ROW_DELETION_AUDIT_SCHEMA_VERSION = 13;

export const importRowDeletionAuditMigration: DatabaseMigration = {
  version: IMPORT_ROW_DELETION_AUDIT_SCHEMA_VERSION,
  name: "import-row-deletion-audit",
  requiresBackup: false,
  legacyNames: ["import-fingerprint-tombstones"],
  legacyRepair: repairLegacyImportRowDeletionAudit,
  up: `
ALTER TABLE import_rows ADD COLUMN deleted_transaction_id TEXT
  CHECK (deleted_transaction_id IS NULL OR (length(deleted_transaction_id) BETWEEN 1 AND 128 AND deleted_transaction_id = trim(deleted_transaction_id)));
`,
  down: `
CREATE TABLE import_rows_rollback (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  raw_json TEXT NOT NULL,
  normalized_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('imported', 'skipped_duplicate', 'needs_review', 'failed')),
  error_code TEXT,
  created_transaction_id TEXT REFERENCES transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE(batch_id, row_number)
) STRICT;
INSERT INTO import_rows_rollback (id, batch_id, row_number, raw_json, normalized_json, status, error_code, created_transaction_id)
SELECT id, batch_id, row_number, raw_json, normalized_json, status, error_code, created_transaction_id FROM import_rows;
DROP TABLE import_rows;
ALTER TABLE import_rows_rollback RENAME TO import_rows;
CREATE INDEX import_rows_batch_status_idx ON import_rows(batch_id, status, row_number);
`,
};

async function repairLegacyImportRowDeletionAudit(database: SqliteDatabase): Promise<void> {
  const columns = await database.query<{ readonly name: string }>("PRAGMA table_info(import_rows)");
  if (columns.some((column) => column.name === "deleted_transaction_id")) return;
  await database.execute(`
ALTER TABLE import_rows ADD COLUMN deleted_transaction_id TEXT
  CHECK (deleted_transaction_id IS NULL OR (length(deleted_transaction_id) BETWEEN 1 AND 128 AND deleted_transaction_id = trim(deleted_transaction_id)));
`);
}
