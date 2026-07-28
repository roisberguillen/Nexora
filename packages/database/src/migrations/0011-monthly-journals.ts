import type { DatabaseMigration } from "./DatabaseMigration";

export const MONTHLY_JOURNALS_SCHEMA_VERSION = 11;
export const monthlyJournalsMigration: DatabaseMigration = {
  version: MONTHLY_JOURNALS_SCHEMA_VERSION,
  name: "monthly-journals",
  requiresBackup: false,
  up: `
CREATE TABLE monthly_journals (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  period TEXT NOT NULL UNIQUE CHECK (
    period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    AND CAST(substr(period, 6, 2) AS INTEGER) BETWEEN 1 AND 12
  ),
  note TEXT CHECK (note IS NULL OR (length(note) BETWEEN 1 AND 4000 AND note = trim(note))),
  next_month_goals TEXT CHECK (next_month_goals IS NULL OR (length(next_month_goals) BETWEEN 1 AND 4000 AND next_month_goals = trim(next_month_goals))),
  perceived_control INTEGER CHECK (perceived_control IS NULL OR perceived_control BETWEEN 1 AND 5),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
`,
  down: `DROP TABLE IF EXISTS monthly_journals;`,
};
