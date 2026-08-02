# Current task

- Task: add optional Google account onboarding for Drive backup
- Roadmap phase: Phase 11
- Category: google_drive
- Profile: ADVANCED with security checkpoint
- Data risk: medium; OAuth token, encrypted remote archive and explicit destructive restore
- Status: implementation and configured synthetic E2E verified locally; live OAuth gate pending
- Initial files: shared cloud session, onboarding, App, BackupPage, tests and backup documentation
- Extra reads: ADR 0015, ADR 0018, backup specification and OAuth operations guide
- Attempts: 1; centralized the volatile OAuth session without changing the Drive scope
- Checkpoint: onboarding after ledger verification; explicit consent; offline continuation preserved
- Completed gates: onboarding component tests, shared-session tests and strict web typecheck
- Completed gates: configured production build and onboarding E2E at five viewports
- Completed gates: full verify (388 tests), full E2E (152 passed, 68 documented skips)
- Pending gate: OAuth account consent/upload/reopen/restore with an authorized deployment Client ID
- Next task: complete Phase 11 live OAuth gate before starting Phase 12
