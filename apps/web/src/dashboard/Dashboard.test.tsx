import { describe, expect, it } from "vitest";

import { barSize } from "./trendBar";

describe("Dashboard trend bars", () => {
  it.each([
    [0n, 100n, 0],
    [100n, 0n, 100],
    [0n, 0n, 0],
    [50n, 100n, 50],
  ])("uses no quantitative height for zero values", (current, previous, expected) => {
    expect(barSize(current, previous)).toBe(expected);
  });
});
