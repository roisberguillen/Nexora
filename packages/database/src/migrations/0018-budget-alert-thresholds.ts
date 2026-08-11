import type { DatabaseMigration } from "./DatabaseMigration";

export const BUDGET_ALERT_THRESHOLDS_SCHEMA_VERSION = 18;

/**
 * Replaces the fixed, legacy alert flags with optional, user-selected thresholds.
 * NULL deliberately preserves a legacy disabled alert; existing enabled alerts map
 * to their historical 80% and 100% meanings.
 */
export const budgetAlertThresholdsMigration: DatabaseMigration = {
  version: BUDGET_ALERT_THRESHOLDS_SCHEMA_VERSION,
  name: "budget-alert-thresholds",
  requiresBackup: false,
  up: `
ALTER TABLE budgets ADD COLUMN first_alert_percentage INTEGER CHECK (first_alert_percentage IS NULL OR first_alert_percentage BETWEEN 1 AND 100);
ALTER TABLE budgets ADD COLUMN second_alert_percentage INTEGER CHECK (second_alert_percentage IS NULL OR second_alert_percentage BETWEEN 1 AND 100);
UPDATE budgets
SET first_alert_percentage = CASE WHEN alert_at_80 = 1 THEN 80 ELSE NULL END,
    second_alert_percentage = CASE WHEN alert_at_100 = 1 THEN 100 ELSE NULL END;
CREATE TRIGGER budgets_alert_thresholds_insert
BEFORE INSERT ON budgets
WHEN NEW.first_alert_percentage IS NOT NULL
 AND NEW.second_alert_percentage IS NOT NULL
 AND NEW.first_alert_percentage >= NEW.second_alert_percentage
BEGIN
  SELECT RAISE(ABORT, 'budget first alert threshold must be lower than second threshold');
END;
CREATE TRIGGER budgets_alert_thresholds_update
BEFORE UPDATE OF first_alert_percentage, second_alert_percentage ON budgets
WHEN NEW.first_alert_percentage IS NOT NULL
 AND NEW.second_alert_percentage IS NOT NULL
 AND NEW.first_alert_percentage >= NEW.second_alert_percentage
BEGIN
  SELECT RAISE(ABORT, 'budget first alert threshold must be lower than second threshold');
END;
`,
  down: `
DROP TRIGGER IF EXISTS budgets_alert_thresholds_update;
DROP TRIGGER IF EXISTS budgets_alert_thresholds_insert;
ALTER TABLE budgets DROP COLUMN second_alert_percentage;
ALTER TABLE budgets DROP COLUMN first_alert_percentage;
`,
};
