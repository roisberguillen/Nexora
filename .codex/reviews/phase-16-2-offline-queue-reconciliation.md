# 16.2 — Offline queue, retry and reconciliation

- Data: 2026-09-08
- Router: `synchronization / CRITICAL / medium`
- Scope: durable-shape queue contract over 16.0/16.1; no UI, SQLite migration or network endpoint change.
- Evidence: `apps/local-hub/src/lib.rs`; `docs/SYNC_SPEC.md`; ADR 0016.
- Queue: pending deliveries are retained until complete reconciliation; attempts increment on each retrieval.
- Reconciliation: only all-`Applied`/`Duplicate` results acknowledge a delivery; conflicts remain pending and visible to the next policy/UI slice.

## Findings

### P0

None.

### P1

None.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 19 passed, 0 failed.
- Negative coverage verifies partial delivery is not dropped and conflict results are not silently acknowledged.
- Browser verification: N/A; UI is reserved for 16.3.

## Conclusion

`SYNC_OFFLINE_QUEUE_PASS` — 16.2 complete; next authorized task is 16.3.
