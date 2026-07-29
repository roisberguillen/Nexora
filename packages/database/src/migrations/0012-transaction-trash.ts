import type { DatabaseMigration } from "./DatabaseMigration";

export const TRANSACTION_TRASH_SCHEMA_VERSION = 12;

export const transactionTrashMigration: DatabaseMigration = {
  version: TRANSACTION_TRASH_SCHEMA_VERSION,
  name: "transaction-trash",
  requiresBackup: false,
  up: `
CREATE TABLE transaction_trash (
  transaction_id TEXT PRIMARY KEY
    REFERENCES transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deleted_at TEXT NOT NULL
    CHECK (deleted_at GLOB '????-??-??T??:??:??.*Z'),
  deletion_group_id TEXT NOT NULL
    CHECK (length(deletion_group_id) BETWEEN 1 AND 128 AND deletion_group_id = trim(deletion_group_id))
) STRICT;

CREATE INDEX transaction_trash_deleted_at_idx
ON transaction_trash(deleted_at ASC, transaction_id ASC);
`,
  down: `
DROP TABLE IF EXISTS transaction_trash;
`,
};
