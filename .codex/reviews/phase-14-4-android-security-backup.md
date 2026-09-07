# 14.4 — Android backup/restore, App Lock and security boundary

Result: `COMPLETE / PASS`

The slice verifies the Android security boundary without inventing a second cryptographic store.
App Lock retains only its PBKDF2 verifier, backup archives remain AES-GCM/passphrase protected,
OAuth credentials remain volatile, and the generated manifest requests no broad storage access.
Android Keystore/biometric integration is not needed by the current persisted-secret contract and
is therefore left to a future explicit architecture decision rather than added silently.

| Check | Result | Evidence |
|---|---|---|
| App Lock negative paths | PASS | Security/AppLock tests cover malformed verifier, wrong passphrase and fail-closed behavior. |
| Backup integrity | PASS | Backup suite covers tamper, wrong passphrase, schema compatibility and rollback. |
| Android permissions | PASS | Generated manifest declares `INTERNET` only; no storage permission. |
| Secret handling | PASS | No passphrase/token is persisted or logged; OAuth is memory-only. |
| Recovery | PASS | Existing recovery verification and restore tests pass. |
| Financial invariants | PASS | No ledger, schema, migration or accounting behavior changed. |

P0: 0  
P1: 0  
P2: 0

Evidence command:

`pnpm test -- apps/web/src/security packages/database/src/backup apps/web/src/backup apps/web/src/startup/RecoveryBackupVerification.ts`
→ 9 files / 43 tests passed.

Next: `14.5 — APK/AAB packaging and emulator/device verification`.
