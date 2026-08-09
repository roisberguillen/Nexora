import type { DatabaseMigration } from "./DatabaseMigration";

export const ADVANCED_RECURRING_RULES_SCHEMA_VERSION = 17;

/**
 * Additive bridge from the v5 monthly schedule columns. The v5 fields remain readable for
 * existing ledgers; v17 fields are the canonical representation for schedules saved by the
 * advanced recurrence domain.
 */
export const advancedRecurringRulesMigration: DatabaseMigration = {
  version: ADVANCED_RECURRING_RULES_SCHEMA_VERSION,
  name: "advanced-recurring-rules",
  requiresBackup: false,
  up: `
ALTER TABLE recurring_rules ADD COLUMN frequency_unit TEXT NOT NULL DEFAULT 'month'
  CHECK (frequency_unit IN ('week', 'month', 'year'));
ALTER TABLE recurring_rules ADD COLUMN interval_value INTEGER NOT NULL DEFAULT 1
  CHECK (interval_value BETWEEN 1 AND 120);
ALTER TABLE recurring_rules ADD COLUMN nominal_month INTEGER
  CHECK (nominal_month IS NULL OR nominal_month BETWEEN 1 AND 12);
ALTER TABLE recurring_rules ADD COLUMN next_nominal_date TEXT
  CHECK (next_nominal_date IS NULL OR (
    next_nominal_date GLOB '????-??-??' AND date(next_nominal_date) = next_nominal_date
  ));
ALTER TABLE recurring_rules ADD COLUMN weekend_policy_v2 TEXT
  CHECK (weekend_policy_v2 IS NULL OR weekend_policy_v2 IN (
    'none', 'previous_business_day', 'next_business_day', 'salary_italy'
  ));
ALTER TABLE recurring_rules ADD COLUMN retired_at TEXT
  CHECK (retired_at IS NULL OR length(retired_at) BETWEEN 1 AND 64);
ALTER TABLE recurring_rules ADD COLUMN expense_variability TEXT
  CHECK (expense_variability IS NULL OR (
    kind = 'expense' AND expense_variability IN ('fixed', 'variable')
  ));
ALTER TABLE recurring_rules ADD COLUMN expense_exceptionality TEXT
  CHECK (expense_exceptionality IS NULL OR (
    kind = 'expense' AND expense_exceptionality IN ('ordinary', 'extraordinary')
  ));

UPDATE recurring_rules
SET interval_value = interval_months,
    weekend_policy_v2 = weekend_policy;

CREATE INDEX recurring_rules_active_cursor_idx
ON recurring_rules(retired_at, enabled, next_expected_date, id)
WHERE retired_at IS NULL;
`,
  down: `
DROP INDEX IF EXISTS recurring_rules_active_cursor_idx;
ALTER TABLE recurring_rules DROP COLUMN expense_exceptionality;
ALTER TABLE recurring_rules DROP COLUMN expense_variability;
ALTER TABLE recurring_rules DROP COLUMN retired_at;
ALTER TABLE recurring_rules DROP COLUMN weekend_policy_v2;
ALTER TABLE recurring_rules DROP COLUMN next_nominal_date;
ALTER TABLE recurring_rules DROP COLUMN nominal_month;
ALTER TABLE recurring_rules DROP COLUMN interval_value;
ALTER TABLE recurring_rules DROP COLUMN frequency_unit;
`,
};
