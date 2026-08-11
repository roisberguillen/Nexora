# Phase checkpoint

- Timestamp: 2026-08-11T16:42:36.670Z
- Task and roadmap phase: Phase 12.5 allocation plans; 12.5
- Profile and data risk: CRITICAL; medium
- Working branch/commit: `feature/phase-12.5-allocations` from `f2ca6fc`
- Scope completed: audit and initial implementation underway; no user ledger opened, reset or replaced.
- Pending scope: complete verification, independent review, manifest, PR and CI publication.
- Files changed/analyzed: allocation domain service/commands, current adapters, portable snapshot,
  recurring and transaction UI, targeted tests.
- Data backup or non-destructive guarantee: existing SQLite/IndexedDB schema is unchanged; portable
  snapshots remain validated before restore and no local archive is overwritten.
- Tests executed: targeted domain, component, SQLite, IndexedDB and portable snapshot tests;
  responsive allocation E2E at all configured viewports pending final gate.
- Known failures: see ../known-failures.md
- Resume command/instruction: pnpm codex:status
