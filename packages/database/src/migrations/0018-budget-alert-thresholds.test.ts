// @vitest-environment node

import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { budgetAlertThresholdsMigration } from "./0018-budget-alert-thresholds";

describe("budget alert thresholds migration", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE budgets (
        id TEXT PRIMARY KEY,
        alert_at_80 INTEGER NOT NULL,
        alert_at_100 INTEGER NOT NULL
      ) STRICT;
      INSERT INTO budgets VALUES ('enabled', 1, 1), ('disabled', 0, 0);
    `);
  });
  afterEach(() => database.close());

  it("preserves legacy alert semantics and accepts configurable percentages", () => {
    database.exec(budgetAlertThresholdsMigration.up);
    expect(database.prepare("SELECT * FROM budgets WHERE id = 'enabled'").get()).toMatchObject({
      first_alert_percentage: 80,
      second_alert_percentage: 100,
    });
    expect(database.prepare("SELECT * FROM budgets WHERE id = 'disabled'").get()).toMatchObject({
      first_alert_percentage: null,
      second_alert_percentage: null,
    });
    database
      .prepare(
        "UPDATE budgets SET first_alert_percentage = 45, second_alert_percentage = 85 WHERE id = 'enabled'",
      )
      .run();
    expect(
      database.prepare("SELECT first_alert_percentage FROM budgets WHERE id = 'enabled'").get(),
    ).toEqual({
      first_alert_percentage: 45,
    });
    expect(() =>
      database
        .prepare(
          "UPDATE budgets SET first_alert_percentage = 85, second_alert_percentage = 85 WHERE id = 'enabled'",
        )
        .run(),
    ).toThrow(/threshold/i);
  });

  it("rolls back threshold columns without deleting legacy budgets", () => {
    database.exec(budgetAlertThresholdsMigration.up);
    database.exec(budgetAlertThresholdsMigration.down);
    expect(
      database.prepare("SELECT id, alert_at_80, alert_at_100 FROM budgets ORDER BY id").all(),
    ).toEqual([
      { id: "disabled", alert_at_80: 0, alert_at_100: 0 },
      { id: "enabled", alert_at_80: 1, alert_at_100: 1 },
    ]);
  });
});
