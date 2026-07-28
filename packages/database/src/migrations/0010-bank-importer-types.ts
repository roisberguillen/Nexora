import type { DatabaseMigration } from "./DatabaseMigration";

export const BANK_IMPORTER_TYPES_SCHEMA_VERSION = 10;

export const bankImporterTypesMigration: DatabaseMigration = {
  version: BANK_IMPORTER_TYPES_SCHEMA_VERSION,
  name: "bank-importer-types",
  requiresBackup: false,
  up: `
ALTER TABLE import_batches ADD COLUMN importer_type_v2 TEXT NOT NULL DEFAULT 'money_manager_xlsx'
  CHECK (importer_type_v2 IN ('money_manager_xlsx', 'mediobanca_xlsx', 'n26_pdf'));
CREATE INDEX import_batches_importer_type_v2_idx ON import_batches(importer_type_v2, started_at DESC);
`,
  down: `
DROP INDEX IF EXISTS import_batches_importer_type_v2_idx;
ALTER TABLE import_batches DROP COLUMN importer_type_v2;
`,
};
