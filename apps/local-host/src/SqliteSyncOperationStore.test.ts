// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SqliteSyncOperationStore } from "./SqliteSyncOperationStore";

describe("SqliteSyncOperationStore", () => {
  it("persists idempotency and incremental cursors after a host reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "nexora-sync-"));
    const filename = join(directory, "sync.sqlite");
    const store = new SqliteSyncOperationStore(filename);
    const operation = { idempotencyKey: "op-1", entityId: "tx-1", baseRevision: 0, payloadDigest: "sha256:a", createdAt: "2026-07-30T00:00:00.000Z" };
    expect(store.apply(operation)).toEqual({ status: "applied", cursor: 1, revision: 1 });
    store.close();
    const reopened = new SqliteSyncOperationStore(filename);
    expect(reopened.after(0)).toEqual([{ cursor: 1, revision: 1, operation }]);
    expect(reopened.apply(operation)).toEqual({ status: "duplicate", cursor: 1, revision: 1 });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
