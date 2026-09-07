# 12.5.F — Release Freeze

Data: 2026-09-07
Branch: `codex/phase-12-5-0-checkpoint`
Baseline: `2a9f38d` (`test(release): close phase 12.5.E final gate`)

## Freeze checklist

| Check | Result | Evidence |
| --- | --- | --- |
| E.1–E.3 and E.F | PASS | phase E reports and state evidence |
| Format/lint/typecheck | PASS | latest `pnpm verify` |
| Unit/integration | PASS | 633 passed, 4 skipped, 0 failed |
| Full E2E | PASS | 433 passed, 233 skipped, 0 failed / 666 |
| Backup/recovery/invariants | PASS | E.3 targeted tests, recovery E2E, cargo check |
| Manifest/orchestrator | PASS | `pnpm manifest:check`, `pnpm codex:validate` |
| UI/UX review | PASS | E.1–E.F scope companions; no runtime UI changes |
| Artifact/secret hygiene | PASS | no credentials, user data, DB, backup or log artifacts |
| Git freeze | PASS | dedicated commits pushed; working tree clean |

## Freeze decision

The 12.5 release candidate is frozen at the current behavior baseline. No feature, redesign,
schema/migration, dependency or runtime change is included in this freeze. Known non-blocking
messages are limited to the jsdom `scrollTo()` notice and Vite chunk-size advisory.

- P0: 0
- P1: 0
- P2: 0

**12.5.F = COMPLETE / PASS**

Phase 13 is now authorized by the roadmap dependency but has not been started. Next task:
`13.0 — Desktop delivery foundation`.
