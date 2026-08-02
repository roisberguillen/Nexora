import type { DatabaseMigration } from "./DatabaseMigration";

export const GENERIC_CSV_IMPORTER_SCHEMA_VERSION = 15;

export const genericCsvImporterMigration: DatabaseMigration = {
  version: GENERIC_CSV_IMPORTER_SCHEMA_VERSION,
  name: "generic-csv-importer",
  requiresBackup: false,
  up: `
ALTER TABLE import_batches ADD COLUMN importer_type_v3 TEXT NOT NULL DEFAULT 'money_manager_xlsx'
  CHECK (importer_type_v3 IN ('money_manager_xlsx', 'mediobanca_xlsx', 'n26_pdf', 'generic_csv'));
CREATE INDEX import_batches_importer_type_v3_idx ON import_batches(importer_type_v3, started_at DESC);
`,
  down: `
DROP INDEX IF EXISTS import_batches_importer_type_v3_idx;
ALTER TABLE import_batches DROP COLUMN importer_type_v3;
`,
};
