import type { DatabaseMigration } from "./DatabaseMigration";

export const MEDIOBANCA_CSV_IMPORTER_SCHEMA_VERSION = 20;

/** Adds an audit discriminator for header-detected Mediobanca Premier CSV batches. */
export const mediobancaCsvImporterMigration: DatabaseMigration = {
  version: MEDIOBANCA_CSV_IMPORTER_SCHEMA_VERSION,
  name: "mediobanca-csv-importer",
  requiresBackup: false,
  up: `
ALTER TABLE import_batches ADD COLUMN importer_type_v4 TEXT NOT NULL DEFAULT 'money_manager_xlsx'
  CHECK (importer_type_v4 IN ('money_manager_xlsx', 'mediobanca_xlsx', 'mediobanca_csv', 'n26_pdf', 'generic_csv'));
UPDATE import_batches SET importer_type_v4 = importer_type_v3;
CREATE INDEX import_batches_importer_type_v4_idx ON import_batches(importer_type_v4, started_at DESC);
`,
  down: `
DROP INDEX IF EXISTS import_batches_importer_type_v4_idx;
ALTER TABLE import_batches DROP COLUMN importer_type_v4;
`,
};
