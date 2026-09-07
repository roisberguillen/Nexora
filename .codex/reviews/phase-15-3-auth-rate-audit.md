# 15.3 — Authenticated operations, rate limiting and audit

- Data: 2026-09-08
- Router: `security_review / CRITICAL / low`
- Scope: authorization and abuse-control contract; no live listener, SQLite sharing or UI feature.
- Evidence: `apps/local-hub/src/lib.rs`; ADR 0016; `docs/THREAT_MODEL.md`.
- Authorization: only paired device identities can authorize and the presented token must verify against the stored digest.
- Rate limiting: independent windowed bucket per device; audit metadata contains device/action/outcome only and never secrets.

## Findings

### P0

None.

### P1

None. Final endpoint wiring and transport-level enforcement are reconciled by 15.F.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml`: 11 passed, 0 failed.
- Negative tests cover unknown device, wrong token, rate-limit isolation/window and secret-free audit metadata.
- Browser verification: N/A; no UI changed.

## Conclusion

`LOCAL_HUB_AUTH_RATE_AUDIT_PASS` — 15.3 complete; next authorized task is 15.F.
