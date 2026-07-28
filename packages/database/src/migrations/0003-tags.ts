import type { DatabaseMigration } from "./DatabaseMigration";

export const TAGS_SCHEMA_VERSION = 3;
export const tagsMigration: DatabaseMigration = {
  version: TAGS_SCHEMA_VERSION,
  name: "tags",
  requiresBackup: false,
  up: `
CREATE TABLE tags (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160 AND name = trim(name)),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE TABLE transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (transaction_id, tag_id)
) STRICT;
CREATE INDEX transaction_tags_tag_idx ON transaction_tags(tag_id, transaction_id);
`,
  down: `DROP TABLE IF EXISTS transaction_tags; DROP TABLE IF EXISTS tags;`,
};
