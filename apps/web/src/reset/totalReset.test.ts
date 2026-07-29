import { describe, expect, it, vi } from "vitest";
import { readTotalResetReport, runTotalReset, writeTotalResetReport } from "./totalReset";

describe("runTotalReset", () => {
  it("preserves local success when one cloud deletion fails", async () => {
    const resetLocal = vi.fn(async () => undefined);
    const report = await runTotalReset({
      resetLocal,
      deleteCloud: true,
      cloud: {
        list: async () => [{ id: "one" }, { id: "two" }] as never,
        delete: async (id) => {
          if (id === "two") throw new Error("cloud_timeout");
        },
      },
    });
    expect(report).toEqual(
      expect.objectContaining({
        local: "succeeded",
        cloudDeleted: 1,
        cloudRemaining: 1,
        cloudErrors: ["cloud_timeout"],
      }),
    );
  });
  it("does not call cloud when local reset fails", async () => {
    const list = vi.fn();
    const report = await runTotalReset({
      resetLocal: async () => {
        throw new Error("blocked");
      },
      deleteCloud: true,
      cloud: { list, delete: vi.fn() },
    });
    expect(report.local).toBe("failed");
    expect(list).not.toHaveBeenCalled();
  });
  it("keeps only the non-sensitive reset report across reload", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    };
    writeTotalResetReport(
      {
        local: "succeeded",
        cloudRequested: true,
        cloudDeleted: 2,
        cloudRemaining: 1,
        cloudErrors: ["cloud_timeout"],
      },
      storage,
    );
    expect(readTotalResetReport(storage)).toMatchObject({
      local: "succeeded",
      cloudDeleted: 2,
      cloudRemaining: 1,
    });
  });
});
