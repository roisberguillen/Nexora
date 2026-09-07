# 16.0 — Replicable operation schema and append-only log

- Data: 2026-09-08
- Router: `database_migration / ADVANCED / low`
- Scope: Rust sync contract only; no SQLite migration, network transport or UI feature.
- Evidence: `apps/local-hub/src/lib.rs`; `docs/SYNC_SPEC.md`; ADR 0016.
- Schema: device/entity IDs, idempotency key, base/current revision, cursor-derived ordering, payload digest, payload and tombstone flag, ISO timestamp.
- Log behavior: append-only entries, deterministic cursor/revision assignment, duplicate replay returns original result, stale base revision returns explicit conflict.

## Findings

### P0

None.

### P1

None.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 16 passed, 0 failed.
- Synthetic payload uses integer minor-unit JSON and tombstone `{}`; no real user data.
- Browser verification: N/A; no UI changed.

## Conclusion

`SYNC_OPERATION_SCHEMA_PASS` — 16.0 complete; next authorized task is 16.1.
