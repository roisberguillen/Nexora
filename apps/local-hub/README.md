# Nexora Local Hub

This crate is the Rust contract foundation for the Local Hub. It does not start
a network listener yet. The default binding is loopback; LAN binding is rejected
until the TLS, device identity and explicit pairing gates are implemented.

The contract carries incremental operation metadata only. It never shares or
opens a SQLite file.
