// @vitest-environment node

import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { genericCsvImporterMigration } from "./0015-generic-csv-importer";

describe("generic CSV importer migration", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE import_batches (
        id TEXT PRIMARY KEY,
        importer_type_v2 TEXT NOT NULL,
        started_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO import_batches VALUES ('legacy-batch', 'n26_pdf', '2026-08-02T00:00:00.000Z');
    `);
  });
  afterEach(() => database.close());

  it("preserves v14 rows and accepts the explicit generic CSV type", () => {
    database.exec(genericCsvImporterMigration.up);
    expect(database.prepare("SELECT importer_type_v3 FROM import_batches").get()).toMatchObject({
      importer_type_v3: "money_manager_xlsx",
    });
    database.prepare("UPDATE import_batches SET importer_type_v3 = 'generic_csv'").run();
    expect(database.prepare("SELECT importer_type_v3 FROM import_batches").get()).toMatchObject({
      importer_type_v3: "generic_csv",
    });
  });

  it("rolls back the v3 discriminator without removing legacy data", () => {
    database.exec(genericCsvImporterMigration.up);
    database.exec(genericCsvImporterMigration.down);
    expect(database.prepare("SELECT importer_type_v2 FROM import_batches").get()).toMatchObject({
      importer_type_v2: "n26_pdf",
    });
  });
});
