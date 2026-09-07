# 16.4 — Recovery, device revocation and multi-device verification

- Data: 2026-09-08
- Router: `synchronization / CRITICAL / medium`
- Scope: recover bounded sync state without dropping pending deliveries, enforce device authorization at push time, and verify deterministic multi-device conflict behavior.
- Evidence: `apps/local-hub/src/lib.rs`, `docs/SYNC_SPEC.md`, ADR 0016.
- Safety: no database copy, silent conflict resolution, or user data reset; revoked credentials fail before transport delivery.

## Findings

### P0

None.

### P1

None.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 22 passed, 0 failed.
- Recovery test restores the checkpoint and pending queue item; revocation test rejects a revoked device; multi-device test retains an explicit conflict result.
- Browser verification: N/A; no route or UI surface changed in this slice.

## Conclusion

`SYNC_RECOVERY_REVOCATION_MULTIDEVICE_PASS` — 16.4 complete; next authorized task is 16.F.
