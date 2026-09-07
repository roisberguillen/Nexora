# 15.2 — Discovery, explicit QR pairing and device revocation

- Data: 2026-09-08
- Router: `local_hub / CRITICAL / medium`
- Scope: typed discovery advertisement and pairing registry; no unauthenticated listener, database sharing or UI feature.
- Evidence: `apps/local-hub/src/lib.rs`; ADR 0016; `docs/SYNC_SPEC.md`.
- Discovery: advertisement is valid only for explicit LAN mode, `_nexora._tcp`, non-empty host fingerprint and non-zero port.
- Pairing: QR grant is bound to host fingerprint, expires, is single-use and produces a device identity; revocation removes access.

## Findings

### P0

None.

### P1

None. Live mDNS/DNS-SD adapter and authenticated endpoint enforcement remain in 15.3/F.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml`: 8 passed, 0 failed.
- Negative tests cover invalid discovery mode, wrong pairing code, expired grant, replayed grant and revocation.
- Browser verification: N/A; no UI or listener changed.

## Conclusion

`LOCAL_HUB_PAIRING_PASS` — 15.2 complete; next authorized task is 15.3.
