import type { DatabaseMigration } from "./DatabaseMigration";

export const INVESTMENT_POSITIONS_SCHEMA_VERSION = 9;
export const investmentPositionsMigration: DatabaseMigration = {
  version: INVESTMENT_POSITIONS_SCHEMA_VERSION,
  name: "investment-positions",
  requiresBackup: false,
  up: `
CREATE TABLE investment_positions (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160 AND name = trim(name)),
  symbol TEXT CHECK (symbol IS NULL OR (length(symbol) BETWEEN 1 AND 32 AND symbol = trim(symbol))),
  units TEXT CHECK (units IS NULL OR (length(units) BETWEEN 1 AND 48 AND units = trim(units))),
  cost_basis_minor TEXT NOT NULL CHECK (cost_basis_minor NOT GLOB '*[^0-9]*'),
  current_value_minor TEXT NOT NULL CHECK (current_value_minor NOT GLOB '*[^0-9]*'),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  valuation_date TEXT NOT NULL CHECK (valuation_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
) STRICT;
CREATE INDEX investment_positions_account_idx ON investment_positions(account_id, valuation_date, id);
`,
  down: `DROP INDEX IF EXISTS investment_positions_account_idx; DROP TABLE IF EXISTS investment_positions;`,
};
