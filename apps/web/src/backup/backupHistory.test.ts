import { describe, expect, it, vi } from "vitest";
import { appendBackupHistory, readBackupHistory } from "./backupHistory";

describe("backup history", () => {
  it("persists only safe technical metadata", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("crypto", { randomUUID: () => "history-1" });
    appendBackupHistory(
      {
        operation: "cloud_upload",
        storageKind: "indexeddb",
        outcome: "succeeded",
        size: 123,
        checksumPrefix: "abcdef123456",
      },
      storage,
      () => new Date("2026-07-29T10:00:00.000Z"),
    );
    expect(readBackupHistory(storage)).toEqual([
      {
        id: "history-1",
        operation: "cloud_upload",
        storageKind: "indexeddb",
        outcome: "succeeded",
        size: 123,
        checksumPrefix: "abcdef123456",
        occurredAt: "2026-07-29T10:00:00.000Z",
      },
    ]);
  });

  it("accepts the manual portable backup receipt", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("crypto", { randomUUID: () => "manual-history-1" });

    appendBackupHistory(
      {
        operation: "manual_backup",
        storageKind: "opfs",
        outcome: "succeeded",
      },
      storage,
    );

    expect(readBackupHistory(storage)[0]).toMatchObject({
      id: "manual-history-1",
      operation: "manual_backup",
      storageKind: "opfs",
    });
  });
});
