# 15.1 — Opt-in LAN binding, TLS and device identity

- Data: 2026-09-07
- Router: `local_hub / CRITICAL / low`
- Scope: fail-closed transport security contract; no network listener or UI feature introduced.
- Evidence: `apps/local-hub/src/lib.rs`; ADR 0016; `docs/SYNC_SPEC.md`.
- Binding: loopback remains the default; LAN requires explicit mode, a specific non-loopback address, certificate, private-key material and host fingerprint.
- Identity: device tokens are represented only by SHA-256 digests; the original token is not persisted, returned or logged.

## Findings

### P0

None.

### P1

None. Rustls server configuration is parsed here; listener integration and client-authenticated operations remain in 15.2–15.3.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml`: 5 passed, 0 failed.
- Negative tests cover missing TLS material, unsafe address and wrong device token.
- `TransportSecurityConfig::server_config` uses rustls PEM parsing and rejects absent/invalid certificate or private key material.
- Browser verification: N/A; no UI/listener changed.

## Conclusion

`LOCAL_HUB_TLS_IDENTITY_PASS` — 15.1 complete; next authorized task is 15.2.
