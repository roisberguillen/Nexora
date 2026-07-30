// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SqliteSyncOperationStore } from "./SqliteSyncOperationStore";

describe("SqliteSyncOperationStore", () => {
  it("stores idempotency and incremental cursors atomically", () => {
    const filename = ":memory:";
    const store = new SqliteSyncOperationStore(filename);
    const operation = { idempotencyKey: "op-1", entityId: "tx-1", baseRevision: 0, payloadDigest: "sha256:a", createdAt: "2026-07-30T00:00:00.000Z" };
    expect(store.apply(operation)).toEqual({ status: "applied", cursor: 1, revision: 1 });
    expect(store.after(0)).toEqual([{ cursor: 1, revision: 1, operation }]);
    expect(store.apply(operation)).toEqual({ status: "duplicate", cursor: 1, revision: 1 });
    store.close();
  });
});
