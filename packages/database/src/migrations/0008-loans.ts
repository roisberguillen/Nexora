import type { DatabaseMigration } from "./DatabaseMigration";

export const LOANS_SCHEMA_VERSION = 8;

export const loansMigration: DatabaseMigration = {
  version: LOANS_SCHEMA_VERSION,
  name: "loans",
  requiresBackup: false,
  up: `
CREATE TABLE loans (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  lender TEXT NOT NULL CHECK (length(lender) BETWEEN 1 AND 120 AND lender = trim(lender)),
  installment_minor TEXT NOT NULL CHECK (substr(installment_minor, 1, 1) BETWEEN '1' AND '9' AND installment_minor NOT GLOB '*[^0-9]*'),
  remaining_principal_minor TEXT NOT NULL CHECK (remaining_principal_minor NOT GLOB '*[^0-9]*'),
  original_principal_minor TEXT CHECK (original_principal_minor IS NULL OR (substr(original_principal_minor, 1, 1) BETWEEN '1' AND '9' AND original_principal_minor NOT GLOB '*[^0-9]*')),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  annual_nominal_rate_bps INTEGER CHECK (annual_nominal_rate_bps BETWEEN 0 AND 1000000),
  annual_effective_rate_bps INTEGER CHECK (annual_effective_rate_bps BETWEEN 0 AND 1000000),
  installments_paid INTEGER CHECK (installments_paid >= 0),
  installments_remaining INTEGER CHECK (installments_remaining >= 0),
  next_due_date TEXT CHECK (next_due_date IS NULL OR next_due_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  CHECK (original_principal_minor IS NULL OR CAST(remaining_principal_minor AS INTEGER) <= CAST(original_principal_minor AS INTEGER))
) STRICT;
CREATE INDEX loans_next_due_idx ON loans(next_due_date, id);
`,
  down: `DROP INDEX IF EXISTS loans_next_due_idx; DROP TABLE IF EXISTS loans;`,
};
