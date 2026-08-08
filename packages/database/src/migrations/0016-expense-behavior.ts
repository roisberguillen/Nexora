import type { DatabaseMigration } from "./DatabaseMigration";

export const EXPENSE_BEHAVIOR_SCHEMA_VERSION = 16;

/** Nullable fields deliberately retain legacy transactions as unclassified. */
export const expenseBehaviorMigration: DatabaseMigration = {
  version: EXPENSE_BEHAVIOR_SCHEMA_VERSION,
  name: "expense-behavior",
  requiresBackup: false,
  up: `
ALTER TABLE transactions ADD COLUMN expense_variability TEXT
  CHECK (expense_variability IS NULL OR (kind = 'expense' AND expense_variability IN ('fixed', 'variable')));
ALTER TABLE transactions ADD COLUMN expense_exceptionality TEXT
  CHECK (expense_exceptionality IS NULL OR (kind = 'expense' AND expense_exceptionality IN ('ordinary', 'extraordinary')));
CREATE INDEX transactions_expense_behavior_idx
ON transactions(expense_variability, expense_exceptionality, booked_date DESC, id)
WHERE kind = 'expense' AND (expense_variability IS NOT NULL OR expense_exceptionality IS NOT NULL);
`,
  down: `
DROP INDEX IF EXISTS transactions_expense_behavior_idx;
ALTER TABLE transactions DROP COLUMN expense_exceptionality;
ALTER TABLE transactions DROP COLUMN expense_variability;
`,
};
