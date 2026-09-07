# 16.1 — Push/pull transport, replay protection and checkpoints

- Data: 2026-09-08
- Router: `synchronization / CRITICAL / medium`
- Scope: transport contract over the append-only operation log; no UI, SQLite migration or network endpoint change.
- Evidence: `apps/local-hub/src/lib.rs`; `docs/SYNC_SPEC.md`; ADR 0016.
- Push: accepts incremental operation batches and preserves operation-level idempotency results.
- Replay: delivery IDs are single-use; duplicate delivery is rejected explicitly.
- Pull/checkpoint: reads after a cursor and rejects acknowledgements beyond the current log.

## Findings

### P0

None.

### P1

None.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 17 passed, 0 failed.
- Synthetic payloads only; no real ledger or open SQLite file involved.
- Browser verification: N/A; no UI changed.

## Conclusion

`SYNC_PUSH_PULL_PASS` — 16.1 complete; next authorized task is 16.2.
