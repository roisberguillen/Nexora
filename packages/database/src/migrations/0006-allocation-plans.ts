import type { DatabaseMigration } from "./DatabaseMigration";

export const ALLOCATION_PLANS_SCHEMA_VERSION = 6;
export const allocationPlansMigration: DatabaseMigration = {
  version: ALLOCATION_PLANS_SCHEMA_VERSION,
  name: "allocation-plans",
  requiresBackup: false,
  up: `
CREATE TABLE allocation_plans (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120 AND name = trim(name)),
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('salary', 'photo_income')),
  source_account_id TEXT NOT NULL REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  target_account_id TEXT NOT NULL REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  amount_minor TEXT NOT NULL CHECK (substr(amount_minor, 1, 1) BETWEEN '1' AND '9' AND amount_minor NOT GLOB '*[^0-9]*'),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  CHECK (source_account_id <> target_account_id)
) STRICT;
CREATE INDEX allocation_plans_trigger_idx ON allocation_plans(trigger_kind, enabled, id);
`,
  down: `DROP INDEX IF EXISTS allocation_plans_trigger_idx; DROP TABLE IF EXISTS allocation_plans;`,
};
