import type { DatabaseMigration } from "./DatabaseMigration";

export const RECURRING_RULES_SCHEMA_VERSION = 5;

export const recurringRulesMigration: DatabaseMigration = {
  version: RECURRING_RULES_SCHEMA_VERSION,
  name: "recurring-rules",
  requiresBackup: false,
  up: `
CREATE TABLE recurring_rules (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120 AND name = trim(name)),
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  amount_minor TEXT NOT NULL CHECK (
    (kind = 'income' AND substr(amount_minor, 1, 1) BETWEEN '1' AND '9' AND amount_minor NOT GLOB '*[^0-9]*')
    OR (kind = 'expense' AND substr(amount_minor, 1, 1) = '-' AND substr(amount_minor, 2, 1) BETWEEN '1' AND '9' AND substr(amount_minor, 2) NOT GLOB '*[^0-9]*')
  ),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  category_id TEXT REFERENCES categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payee TEXT CHECK (payee IS NULL OR (length(payee) BETWEEN 1 AND 240 AND payee = trim(payee))),
  frequency TEXT NOT NULL CHECK (frequency = 'monthly'),
  interval_months INTEGER NOT NULL DEFAULT 1 CHECK (interval_months >= 1),
  nominal_day INTEGER NOT NULL CHECK (nominal_day BETWEEN 1 AND 31),
  weekend_policy TEXT NOT NULL CHECK (weekend_policy IN ('none', 'salary_italy')),
  next_expected_date TEXT NOT NULL CHECK (next_expected_date GLOB '????-??-??'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX recurring_rules_due_idx ON recurring_rules(enabled, next_expected_date, id);
CREATE INDEX recurring_rules_account_idx ON recurring_rules(account_id, id);
`,
  down: `
DROP INDEX IF EXISTS recurring_rules_account_idx;
DROP INDEX IF EXISTS recurring_rules_due_idx;
DROP TABLE IF EXISTS recurring_rules;
`,
};
