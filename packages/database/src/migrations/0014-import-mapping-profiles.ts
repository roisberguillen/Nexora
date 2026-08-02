import type { DatabaseMigration } from "./DatabaseMigration";

export const IMPORT_MAPPING_PROFILES_SCHEMA_VERSION = 14;

export const importMappingProfilesMigration: DatabaseMigration = {
  version: IMPORT_MAPPING_PROFILES_SCHEMA_VERSION,
  name: "import-mapping-profiles",
  requiresBackup: false,
  up: `
ALTER TABLE import_batches ADD COLUMN mapping_profile_id TEXT
  CHECK (mapping_profile_id IS NULL OR (length(mapping_profile_id) BETWEEN 1 AND 128 AND mapping_profile_id = trim(mapping_profile_id)));
`,
  down: `
ALTER TABLE import_batches DROP COLUMN mapping_profile_id;
`,
};
