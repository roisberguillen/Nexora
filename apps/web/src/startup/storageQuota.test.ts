import { describe, expect, it } from "vitest";

import { estimateStorageQuota } from "./storageQuota";

describe("estimateStorageQuota", () => {
  it("classifies a nearly full storage area without mutating it", async () => {
    const result = await estimateStorageQuota(
      { estimate: async () => ({ usage: 900, quota: 1_000 }) },
      0.9,
    );

    expect(result).toMatchObject({
      available: true,
      usage: 900,
      quota: 1_000,
      usageRatio: 0.9,
      atRisk: true,
    });
  });

  it("fails closed when quota estimation is unavailable", async () => {
    await expect(estimateStorageQuota(undefined)).resolves.toEqual({
      available: false,
      usage: 0,
      quota: 0,
      usageRatio: null,
      atRisk: false,
    });
  });
});
