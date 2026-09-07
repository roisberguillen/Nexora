# 15.0 — Local Hub Rust service foundation and API contract

- Data: 2026-09-07
- Router: `local_hub / CRITICAL / medium`
- Scope: Rust contract foundation only; no listener, LAN exposure, SQLite access, backup behavior or new UI feature.
- Evidence: `apps/local-hub/src/lib.rs`; `apps/local-hub/README.md`; `docs/SYNC_SPEC.md`; ADR 0016.
- Security posture: default `127.0.0.1:43173`; LAN configuration fails closed until TLS, device identity and explicit pairing are present.
- Contract: API version, health response, cursor query and incremental operation metadata with idempotency key, device identity, entity, base revision, digest and timestamp.
- Data invariant: no open SQLite file or database payload is shared; accounting invariants are untouched.

## Findings

### P0

None.

### P1

None. LAN binding is intentionally unavailable until 15.1–15.3.

### P2

None.

## Verification

- `cargo test --manifest-path apps/local-hub/Cargo.toml`: 3 passed, 0 failed.
- Negative checks: LAN binding rejected before security gates; operation JSON contains no SQLite payload.
- Browser verification: N/A; this slice has no UI or listener.
- Completion commit: task trailer `Nexora-Task: 15.0` is recorded on the closing commit.

## Conclusion

`LOCAL_HUB_FOUNDATION_PASS` — 15.0 complete; next authorized task is 15.1.
