# ADR 0015: Google Drive appData OAuth

## Decision

Use Google Identity Services in the PWA and the `drive.appdata` scope. The OAuth client ID is a
public build-time variable; no client secret or token is persisted.

The web shell keeps `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` for SQLite/OPFS. A dedicated static OAuth bridge is
the sole route with `Cross-Origin-Opener-Policy: same-origin-allow-popups`. It opens Google
Identity Services only after a second explicit click, then returns an in-memory token through a
nonce-bound `BroadcastChannel`; it never mounts the ledger or persists a token.

## Consequences

Cloud backup is isolated from user-visible Drive files and can be disabled without affecting local
backup. Google Drive adapters must receive only encrypted archives and non-sensitive metadata.
