import { describe, expect, it } from "vitest";
import { MonthlyJournal } from "./MonthlyJournal";
describe("MonthlyJournal", () => {
  it("normalizes manual notes for one ISO month", () => {
    expect(
      MonthlyJournal.create({
        id: "journal-2026-07",
        period: "2026-07",
        note: " nota ",
        perceivedControl: 4,
      }),
    ).toMatchObject({ note: "nota", period: "2026-07" });
  });
  it("rejects an invalid month", () =>
    expect(() => MonthlyJournal.create({ id: "journal", period: "2026-13" })).toThrow("period"));
});
