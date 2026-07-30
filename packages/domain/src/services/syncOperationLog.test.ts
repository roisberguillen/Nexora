import { describe, expect, it } from "vitest";

import { SyncOperationLog } from "./syncOperationLog";

describe("SyncOperationLog", () => {
  it("deduplicates retries and exposes a conflict instead of overwriting a stale entity", () => {
    const log = new SyncOperationLog();
    const operation = { idempotencyKey: "op-001", entityId: "transaction-1", baseRevision: 0, payloadDigest: "sha256:one", createdAt: "2026-07-30T00:00:00.000Z" };
    expect(log.apply(operation)).toEqual({ status: "applied", cursor: 1, revision: 1 });
    expect(log.apply(operation)).toEqual({ status: "duplicate", cursor: 1, revision: 1 });
    expect(log.apply({ ...operation, idempotencyKey: "op-002", payloadDigest: "sha256:two" })).toEqual({ status: "conflict", currentRevision: 1 });
    expect(log.after(0)).toEqual([{ cursor: 1, operation, revision: 1 }]);
  });
});
