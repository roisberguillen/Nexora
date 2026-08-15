import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mediobancaCsvImporterMigration } from "./0020-mediobanca-csv-importer";

describe("Mediobanca CSV importer migration", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE import_batches (
        id TEXT PRIMARY KEY,
        importer_type_v3 TEXT NOT NULL,
        started_at TEXT NOT NULL
      );
      INSERT INTO import_batches (id, importer_type_v3, started_at)
      VALUES ('legacy', 'generic_csv', '2026-08-15T00:00:00.000Z');
    `);
  });

  afterEach(() => database.close());

  it("preserves existing types and accepts the auditable Mediobanca CSV discriminator", () => {
    database.exec(mediobancaCsvImporterMigration.up);
    expect(database.prepare("SELECT importer_type_v4 FROM import_batches").get()).toMatchObject({
      importer_type_v4: "generic_csv",
    });
    database
      .prepare("UPDATE import_batches SET importer_type_v4 = 'mediobanca_csv' WHERE id = 'legacy'")
      .run();
    expect(database.prepare("SELECT importer_type_v4 FROM import_batches").get()).toMatchObject({
      importer_type_v4: "mediobanca_csv",
    });
  });

  it("rolls back only the new discriminator column", () => {
    database.exec(mediobancaCsvImporterMigration.up);
    database.exec(mediobancaCsvImporterMigration.down);
    expect(database.prepare("SELECT importer_type_v3 FROM import_batches").get()).toMatchObject({
      importer_type_v3: "generic_csv",
    });
  });
});
