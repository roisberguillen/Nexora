// @vitest-environment node

import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { importMappingProfilesMigration } from "./0014-import-mapping-profiles";

describe("import mapping profiles migration", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE import_batches (
        id TEXT PRIMARY KEY,
        source_filename TEXT NOT NULL
      ) STRICT;
      INSERT INTO import_batches (id, source_filename) VALUES ('legacy-batch', 'legacy.xlsx');
    `);
  });

  afterEach(() => database.close());

  it("upgrades a v13 batch additively without changing existing data", () => {
    database.exec(importMappingProfilesMigration.up);
    const row = database
      .prepare("SELECT id, source_filename, mapping_profile_id FROM import_batches")
      .get() as unknown as Record<string, unknown>;

    expect(row).toEqual({
      id: "legacy-batch",
      source_filename: "legacy.xlsx",
      mapping_profile_id: null,
    });
    expect(() =>
      database.prepare("UPDATE import_batches SET mapping_profile_id = ' mapping-profile '").run(),
    ).toThrow();
  });

  it("rolls back only the additive column and preserves the batch", () => {
    database.exec(importMappingProfilesMigration.up);
    database.prepare("UPDATE import_batches SET mapping_profile_id = 'mapping-profile-1'").run();
    database.exec(importMappingProfilesMigration.down);

    const columns = database.prepare("PRAGMA table_info(import_batches)").all() as unknown as {
      readonly name: string;
    }[];
    expect(columns.map(({ name }) => name)).toEqual(["id", "source_filename"]);
    expect(database.prepare("SELECT id, source_filename FROM import_batches").get()).toMatchObject({
      id: "legacy-batch",
      source_filename: "legacy.xlsx",
    });
  });
});
