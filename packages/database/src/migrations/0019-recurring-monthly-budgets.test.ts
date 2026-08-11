// @vitest-environment node

import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { recurringMonthlyBudgetsMigration } from "./0019-recurring-monthly-budgets";

describe("recurring monthly budgets migration", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE budgets (
        id TEXT PRIMARY KEY,
        period TEXT NOT NULL,
        category_id TEXT,
        amount_minor TEXT NOT NULL,
        currency TEXT NOT NULL,
        alert_at_80 INTEGER NOT NULL,
        alert_at_100 INTEGER NOT NULL,
        first_alert_percentage INTEGER,
        second_alert_percentage INTEGER
      ) STRICT;
      INSERT INTO budgets VALUES
        ('food-jun', '2026-06', 'food', '50000', 'EUR', 1, 1, 70, 90),
        ('food-jul', '2026-07', 'food', '60000', 'EUR', 1, 1, 70, 90),
        ('food-aug', '2026-08', 'food', '70000', 'EUR', 1, 1, 70, 90),
        ('global-aug', '2026-08', NULL, '100000', 'EUR', 1, 1, 80, 100);
    `);
  });
  afterEach(() => database.close());

  it("turns legacy month rows into a non-destructive effective-dated series", () => {
    database.exec(recurringMonthlyBudgetsMigration.up);
    expect(
      database
        .prepare("SELECT id, series_id, period, effective_to_period FROM budgets ORDER BY id")
        .all(),
    ).toEqual([
      { id: "food-aug", series_id: "food-jun", period: "2026-08", effective_to_period: null },
      { id: "food-jul", series_id: "food-jun", period: "2026-07", effective_to_period: "2026-08" },
      { id: "food-jun", series_id: "food-jun", period: "2026-06", effective_to_period: "2026-07" },
      { id: "global-aug", series_id: "global-aug", period: "2026-08", effective_to_period: null },
    ]);
  });

  it("rolls back only the added columns and indexes", () => {
    database.exec(recurringMonthlyBudgetsMigration.up);
    database.exec(recurringMonthlyBudgetsMigration.down);
    expect(
      database.prepare("SELECT id, period, amount_minor FROM budgets ORDER BY id").all(),
    ).toHaveLength(4);
  });
});
