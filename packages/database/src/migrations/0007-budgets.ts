import type { DatabaseMigration } from "./DatabaseMigration";

export const BUDGETS_SCHEMA_VERSION = 7;

export const budgetsMigration: DatabaseMigration = {
  version: BUDGETS_SCHEMA_VERSION,
  name: "budgets",
  requiresBackup: false,
  up: `
CREATE TABLE budgets (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  period TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(period, 6, 2) BETWEEN '01' AND '12'),
  category_id TEXT REFERENCES categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  amount_minor TEXT NOT NULL CHECK (substr(amount_minor, 1, 1) BETWEEN '1' AND '9' AND amount_minor NOT GLOB '*[^0-9]*'),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  alert_at_80 INTEGER NOT NULL DEFAULT 1 CHECK (alert_at_80 IN (0, 1)),
  alert_at_100 INTEGER NOT NULL DEFAULT 1 CHECK (alert_at_100 IN (0, 1)),
  UNIQUE(period, category_id)
) STRICT;
CREATE INDEX budgets_period_idx ON budgets(period, id);
`,
  down: `DROP INDEX IF EXISTS budgets_period_idx; DROP TABLE IF EXISTS budgets;`,
};
