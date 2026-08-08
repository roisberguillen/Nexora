# Current task

- Task: complete opt-in Google Drive backup onboarding
- Roadmap phase: Phase 11
- Category: google_drive
- Profile: ADVANCED with security checkpoint
- Data risk: medium; OAuth token, encrypted remote archive and explicit destructive restore
- Status: implementation and configured synthetic E2E verified locally; live OAuth gate pending
- Initial files: shared cloud session, onboarding, App, BackupPage, tests and backup documentation
- Extra reads: ADR 0015, ADR 0018, backup specification and OAuth operations guide
- Attempts: 5; GIS is preloaded silently only while the Backup page is open, then the explicit
  connect click invokes the token client synchronously without an intervening promise. The actual
  callback failure was traced to `COOP: same-origin` severing cross-origin popup communication.
- Checkpoint: Drive consent is available only from Backup; explicit consent and offline continuation preserved
- Completed gates: Backup-only consent regression tests, shared-session tests and strict web typecheck
- Completed gates: configured production build and Backup entry-point E2E at five viewports
- Completed gates: full verify (388 tests), full E2E (152 passed, 68 documented skips)
- Pending gate: OAuth account consent/upload/reopen/restore with an authorized deployment Client ID
- Pending gate: configure the production OAuth consent screen and exact authorized origins, then
  complete the live consent/upload/reopen/restore drill before starting Phase 12
- Latest live evidence: the authorized account chooser opens after the explicit Backup action.
  The app shell retains `COOP: same-origin`; an isolated OAuth bridge has
  `same-origin-allow-popups` and returns only a nonce-bound volatile token. The local HTTP
  verification confirms these distinct headers; no archive was uploaded.
