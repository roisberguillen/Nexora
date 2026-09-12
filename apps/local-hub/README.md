# Nexora Local Hub

This crate contains the Rust Local Hub runtime foundation. `serve` starts a
loopback listener by default, and `LocalHubRuntime` provides tested
start/stop/restart/status lifecycle control. LAN startup requires a specific
address, Rustls certificate/key material, host fingerprint and explicit
security configuration; the lifecycle controller remains fail-closed until
pairing is wired into the later PC Manager phases. The router keeps health
public and authorization fail-closed for unpaired or invalid devices.

Discovery uses the explicit `_nexora._tcp` service and `assess_same_network`
provides a preflight hint for same-subnet UX. Network proximity never replaces
TLS, host fingerprint verification or device pairing.

The contract carries incremental operation metadata only. It never shares or
opens a SQLite file. Discovery advertisement, QR pairing and revocation are
typed contracts; mDNS/DNS-SD provider integration remains a separate gate.
