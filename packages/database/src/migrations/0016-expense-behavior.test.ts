// @vitest-environment node

import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { expenseBehaviorMigration } from "./0016-expense-behavior";

describe("expense behavior migration", () => {
  let database: DatabaseSync;
  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`CREATE TABLE transactions (id TEXT PRIMARY KEY, kind TEXT NOT NULL, booked_date TEXT NOT NULL) STRICT;
      INSERT INTO transactions VALUES ('legacy', 'expense', '2026-08-08');`);
  });
  afterEach(() => database.close());

  it("preserves legacy rows and accepts only behavior for expenses", () => {
    database.exec(expenseBehaviorMigration.up);
    expect(
      database.prepare("SELECT expense_variability FROM transactions WHERE id = 'legacy'").get(),
    ).toEqual({ expense_variability: null });
    database
      .prepare(
        "UPDATE transactions SET expense_variability = 'fixed', expense_exceptionality = 'ordinary' WHERE id = 'legacy'",
      )
      .run();
    expect(() =>
      database
        .prepare(
          "UPDATE transactions SET expense_variability = 'fixed', kind = 'income' WHERE id = 'legacy'",
        )
        .run(),
    ).toThrow();
  });

  it("rolls back columns without deleting legacy rows", () => {
    database.exec(expenseBehaviorMigration.up);
    database.exec(expenseBehaviorMigration.down);
    expect(database.prepare("SELECT id FROM transactions").get()).toEqual({ id: "legacy" });
  });
});
