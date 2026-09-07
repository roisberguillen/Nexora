# 15.F — Final Local Hub gate

- Data: 2026-09-08
- Router: `local_hub / CRITICAL / medium`
- Result: `BLOCKED`
- Evidence reviewed: `apps/local-hub/src/lib.rs`, ADR 0016, `docs/SYNC_SPEC.md`, `docs/THREAT_MODEL.md`, 15.0–15.3 reports.

## Findings

### P0

None.

### P1

- `LH-15F-01` — The repository now exposes a live Axum/Tokio router/runtime and an `mdns-sd` provider integration; a final LAN/discovery gate still requires an independent review of the real network boundary.
- `LH-15F-02` — An independent network-security review required by the Nexora security/sync skills is unavailable in this execution environment.

Security follow-up completed after the initial gate audit: pairing now checks the expected host fingerprint and no longer derives the device credential from the QR code itself. The independent-review P1 remains open.

Discovery negative coverage added: invalid service/mode is rejected before the mDNS daemon starts.

Runtime hardening review: TLS configuration is validated before LAN socket binding; rate-limit exhaustion returns `429`; clippy is clean. No new P0/P1/P2 finding was introduced.

Constant-time review: device token digest comparison now uses `subtle::ConstantTimeEq`; no secret is logged or serialized.

### P2

None.

## Required unblock evidence

1. Exercise the live Rust transport and `mdns-sd` publication against loopback and explicit LAN opt-in with TLS and authenticated paired-device requests.
2. Obtain an independent security review of binding, TLS, pairing, discovery, revocation, replay and audit behavior.

## Conclusion

`LOCAL_HUB_FINAL_GATE_NOT_PASS` — Phase 16 must not start until the P1 findings are closed and the independent review is attached.
