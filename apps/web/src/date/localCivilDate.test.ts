import { describe, expect, it } from "vitest";
import { localCivilDate, localCivilMonth } from "./localCivilDate";

describe("local civil date", () => {
  it.each([
    ["2026-03-31T22:30:00.000Z", "2026-04-01"],
    ["2026-12-31T23:30:00.000Z", "2027-01-01"],
    ["2026-03-29T00:30:00.000Z", "2026-03-29"],
    ["2026-10-25T00:30:00.000Z", "2026-10-25"],
  ])("uses Europe/Rome civil day for %s", (instant, expected) => {
    expect(localCivilDate(new Date(instant))).toBe(expected);
  });
  it("derives month from the local calendar day", () => {
    expect(localCivilMonth(new Date("2026-03-31T22:30:00.000Z"))).toBe("2026-04");
    expect(localCivilMonth(new Date("2026-12-31T23:30:00.000Z"))).toBe("2027-01");
  });
});
