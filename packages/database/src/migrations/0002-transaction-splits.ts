import type { DatabaseMigration } from "./DatabaseMigration";

export const TRANSACTION_SPLITS_SCHEMA_VERSION = 2;

export const transactionSplitsMigration: DatabaseMigration = {
  version: TRANSACTION_SPLITS_SCHEMA_VERSION,
  name: "transaction-splits",
  requiresBackup: false,
  up: `
CREATE TABLE transaction_splits (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  amount_minor TEXT NOT NULL CHECK (
    (substr(amount_minor, 1, 1) BETWEEN '1' AND '9' AND amount_minor NOT GLOB '*[^0-9]*')
    OR (substr(amount_minor, 1, 1) = '-' AND substr(amount_minor, 2, 1) BETWEEN '1' AND '9' AND substr(amount_minor, 2) NOT GLOB '*[^0-9]*')
  ),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  note TEXT CHECK (note IS NULL OR (length(note) BETWEEN 1 AND 2000 AND note = trim(note))),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX transaction_splits_transaction_idx ON transaction_splits(transaction_id, id);
CREATE INDEX transaction_splits_category_idx ON transaction_splits(category_id, id);

CREATE TRIGGER transaction_splits_validate_on_insert
BEFORE INSERT ON transaction_splits
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM transactions AS transaction_row
    JOIN categories AS category_row ON category_row.id = NEW.category_id
    WHERE transaction_row.id = NEW.transaction_id
      AND transaction_row.kind IN ('income', 'expense')
      AND transaction_row.status <> 'cancelled'
      AND transaction_row.category_id IS NULL
      AND transaction_row.currency = NEW.currency
      AND ((transaction_row.amount_minor LIKE '-%' AND NEW.amount_minor LIKE '-%') OR (transaction_row.amount_minor NOT LIKE '-%' AND NEW.amount_minor NOT LIKE '-%'))
      AND category_row.is_archived = 0
      AND (category_row.kind_scope = 'both' OR category_row.kind_scope = transaction_row.kind)
  ) THEN RAISE(ABORT, 'invalid transaction split') END;
END;
`,
  down: `
DROP TRIGGER IF EXISTS transaction_splits_validate_on_insert;
DROP TABLE IF EXISTS transaction_splits;
`,
};
