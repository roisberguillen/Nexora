# ADR 0015: Google Drive appData OAuth

## Decision

Use Google Identity Services in the PWA and the `drive.appdata` scope. The OAuth client ID is a
public build-time variable; no client secret or token is persisted.

## Consequences

Cloud backup is isolated from user-visible Drive files and can be disabled without affecting local
backup. Google Drive adapters must receive only encrypted archives and non-sensitive metadata.
