# 17.2 — Service Worker A→B update and backup/restore regression

- Data: 2026-09-08
- Router: `manual_backup / ADVANCED / medium`
- Scope: verify existing explicit PWA update signaling and backup integrity/rollback paths; no format or encryption change.

P0: None.  
P1: None.  
P2: None.

## Verification

- PWA notice and backup regression Vitest: 34 passed, 0 failed.
- Service Worker apply is user-triggered after the ready event; checksum failure does not silently restore.
- No SQLite migration or accounting invariant changed.

Gate result: PASS.

`PWA_BACKUP_REGRESSION_PASS` — 17.2 complete; next authorized task is 17.3.
