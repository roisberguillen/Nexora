# 14.3 — Responsive mobile UI and least-privilege file/document picker workflows

Result: `COMPLETE / PASS`

The existing accessible HTML file inputs are retained as the WebView document picker for Android
and desktop/browser surfaces. No broader native file permission or picker plugin is introduced.

| Check | Result | Evidence |
|---|---|---|
| Import picker semantics | PASS | `input[type=file]` with constrained CSV/XLSX/PDF accept list and existing dry-run flow. |
| Backup/restore picker semantics | PASS | `input[type=file]` constrained to encrypted backup extension/octet-stream. |
| Responsive browser verification | PASS | Playwright 45 passed, 9 documented skips across 320, 375, 390, 768, 1024 and 1440 px. |
| Import/backup behavior | PASS | Preview-before-commit, cancellation, deduplication, verification and restore flows passed. |
| Least privilege | PASS | No Android storage permission or unrestricted filesystem API added. |
| Financial invariants | PASS | No ledger, schema, migration or accounting behavior changed. |

P0: 0  
P1: 0  
P2: 0

Evidence command:

`pnpm exec playwright test test/e2e/backup-manual-ui.spec.ts test/e2e/imports.spec.ts` → 45 passed,
9 skipped, 0 failed.

Next: `14.4 — Android backup/restore, App Lock, Keystore/biometric boundary and permissions`.
