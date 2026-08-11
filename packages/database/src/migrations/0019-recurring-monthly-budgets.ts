import type { DatabaseMigration } from "./DatabaseMigration";

/**
 * Preserves `period` as the effective-from value. Existing per-month rows become a
 * chronological revision series; nothing is deleted and global legacy rows stay readable.
 */
export const recurringMonthlyBudgetsMigration: DatabaseMigration = {
  version: 19,
  name: "recurring-monthly-budgets",
  // The browser bootstrap supplies a verified local checkpoint before an existing OPFS upgrade.
  // Keeping the catalog migration itself additive lets pristine and test-ledger creation proceed.
  requiresBackup: false,
  up: `
ALTER TABLE budgets ADD COLUMN series_id TEXT;
ALTER TABLE budgets ADD COLUMN effective_to_period TEXT CHECK (effective_to_period IS NULL OR effective_to_period GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]');
UPDATE budgets
SET series_id = (
  SELECT first_revision.id FROM budgets AS first_revision
  WHERE first_revision.category_id IS budgets.category_id
  ORDER BY first_revision.period ASC, first_revision.id ASC LIMIT 1
);
UPDATE budgets
SET effective_to_period = (
  SELECT following.period FROM budgets AS following
  WHERE following.category_id IS budgets.category_id
    AND following.period > budgets.period
  ORDER BY following.period ASC, following.id ASC LIMIT 1
);
CREATE INDEX budgets_series_period_idx ON budgets(series_id, period);
CREATE INDEX budgets_scope_effective_idx ON budgets(category_id, period, effective_to_period);
`,
  down: `
DROP INDEX IF EXISTS budgets_scope_effective_idx;
DROP INDEX IF EXISTS budgets_series_period_idx;
ALTER TABLE budgets DROP COLUMN effective_to_period;
ALTER TABLE budgets DROP COLUMN series_id;
`,
};
