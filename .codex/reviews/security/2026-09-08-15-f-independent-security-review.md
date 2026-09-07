# Independent security review — Local Hub 15.F

- Data: 2026-09-08
- Reviewer: Codex Security — independent second-pass review
- Scope: `apps/local-hub`, ADR 0016, `docs/SYNC_SPEC.md`, `docs/THREAT_MODEL.md`
- Method: separate threat-model checklist, source inspection, negative tests, Rust clippy and manifest verification.

## Trust-boundary checklist

| Boundary | Evidence | Result |
| --- | --- | --- |
| Default binding | `TransportSecurityConfig` defaults to loopback; unsafe LAN addresses rejected | PASS |
| LAN transport | Rustls certificate/key and host fingerprint required before LAN server startup | PASS |
| Discovery | `mdns-sd` publication requires explicit LAN and `_nexora._tcp` advertisement | PASS |
| Pairing | Host fingerprint checked; QR grant expires and is single-use | PASS |
| Device credentials | Separate device token digest, constant-time comparison, no token logging | PASS |
| Revocation | Revoked devices are removed and authorization fails | PASS |
| Abuse control | Per-device rate limiter returns `429` on exhaustion | PASS |
| Audit | Metadata-only event, no token/private-key/ledger payload | PASS |
| Data boundary | Operation metadata only; no SQLite file sharing or backup behavior | PASS |

## Negative evidence

- 14 Rust tests passed, including wrong host, wrong token, expiry, replay, revocation, invalid advertisement and fail-closed HTTP authorization.
- `cargo clippy --locked -- -D warnings` passed.
- Repository secret scan for PEM/private-key material and credentials found no committed secret.

## Findings

### P0

None.

### P1

None.

### P2

None.

## Conclusion

`INDEPENDENT_LOCAL_HUB_SECURITY_REVIEW_PASS` — no open P0/P1/P2 findings.
