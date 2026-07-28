import type { DatabaseMigration } from "./DatabaseMigration";

export const IMPORT_BATCHES_SCHEMA_VERSION = 4;

export const importBatchesMigration: DatabaseMigration = {
  version: IMPORT_BATCHES_SCHEMA_VERSION,
  name: "import-batches",
  requiresBackup: false,
  up: `
ALTER TABLE transactions ADD COLUMN import_batch_id TEXT
  REFERENCES import_batches(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE transactions ADD COLUMN source_fingerprint TEXT
  CHECK (source_fingerprint IS NULL OR (length(source_fingerprint) = 64 AND source_fingerprint NOT GLOB '*[^0-9a-f]*'));
CREATE TABLE import_batches (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  importer_type TEXT NOT NULL CHECK (importer_type IN ('money_manager_xlsx')),
  source_filename TEXT NOT NULL CHECK (length(source_filename) BETWEEN 1 AND 500 AND source_filename = trim(source_filename)),
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64 AND source_sha256 NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL CHECK (status IN ('previewed', 'committed', 'undone', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  rows_total INTEGER NOT NULL CHECK (rows_total >= 0),
  rows_imported INTEGER NOT NULL DEFAULT 0 CHECK (rows_imported >= 0),
  rows_skipped INTEGER NOT NULL DEFAULT 0 CHECK (rows_skipped >= 0),
  rows_failed INTEGER NOT NULL DEFAULT 0 CHECK (rows_failed >= 0),
  CHECK (rows_imported + rows_skipped + rows_failed <= rows_total)
) STRICT;
CREATE TABLE import_rows (
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
CREATE UNIQUE INDEX transactions_import_fingerprint_idx
ON transactions(account_id, source_fingerprint)
WHERE source_fingerprint IS NOT NULL;
CREATE INDEX import_rows_batch_status_idx ON import_rows(batch_id, status, row_number);
`,
  down: `
DROP INDEX IF EXISTS import_rows_batch_status_idx;
DROP INDEX IF EXISTS transactions_import_fingerprint_idx;
DROP TABLE IF EXISTS import_rows;
DROP TABLE IF EXISTS import_batches;
`,
};
