# 12.5.E.2 — Real-Flow Full Regression Gate

Data: 2026-09-07
Branch: `codex/phase-12-5-0-checkpoint`
Baseline: `801234a` (`test(release): pass phase 12.5.E.1 quality gate`)

## Preconditions

- `12.5.D = PASS` — `.codex/reviews/phase-12.5-d-f-final-gate.md`.
- `12.5.E.1 = PASS` — `.codex/reviews/phase-12.5-e-1-final-quality-gate.md`.

## Real-flow matrix

| ID | Flow | Result | Evidence | Severity |
| --- | --- | --- | --- | --- |
| RF-01 | Startup, shell, loading/reopen | PASS | `startup.spec.ts`, C4.1, startup resilience | — |
| RF-02 | Conti: create, persist, archive | PASS | `accounts.spec.ts`, C4.1 | — |
| RF-03 | Entrata | PASS | C4.2 complete cycle and dashboard | — |
| RF-04 | Uscita | PASS | C4.2 complete cycle, balance and analytics | — |
| RF-05 | Trasferimento atomico | PASS | C4.3 reconciliation, neutral reporting, persistence | — |
| RF-06 | Modifica movimento | PASS | C4.2 edit/reopen reconciliation | — |
| RF-07 | Cestino/restore/purge | PASS | `transactions.spec.ts`, C4.10 | — |
| RF-08 | Movimenti search/filter/detail | PASS | `transactions.spec.ts` real search and combined filters | — |
| RF-09 | Budget and expense progress | PASS | `budgets.spec.ts`, C4.5 | — |
| RF-10 | Ricorrenze | PASS | `recurring.spec.ts`, C4.5 | — |
| RF-11 | Allocazioni | PASS | C4.5 deterministic allocation cycle and reload | — |
| RF-12 | Prestiti | PASS | `loans.spec.ts`, C4.6 create/edit/reopen | — |
| RF-13 | Investimenti | PASS | `investments.spec.ts`, C4.6 create/edit/reopen | — |
| RF-14 | Analytics | PASS | C4.6 dashboard/analytics reconciliation | — |
| RF-15 | Diario finanziario | PASS | C4.4 journal persistence and reopen | — |
| RF-16 | Categorie | PASS | `categories.spec.ts` create/edit/merge/archive | — |
| RF-17 | Tag | PASS | `tags.spec.ts` create/assign/merge/persist | — |
| RF-18 | Money Manager import | PASS | C4.7 XLSX plan, mapping, preview, dry-run, commit and report | — |
| RF-19 | Import idempotency | PASS | C4.7 reimport/deduplication evidence | — |
| RF-20 | Undo import | PASS | C4.7 exclusive batch undo and post-undo reconciliation | — |
| RF-21 | Export | PASS | `exports.spec.ts`, C4.8 export validity/scope | — |
| RF-22 | Backup locale | PASS | C4.9 manual encrypted backup and verification | — |
| RF-23 | Restore A → B → A | PASS | C4.9 backup/restore/rollback and reopen | — |
| RF-24 | Notifiche | PASS | C4.5/C3.17 local read/deep-link persistence | — |
| RF-25 | Profilo/preferenze | PASS | C4.10 and `transactions.spec.ts` reload checks | — |
| RF-26 | App Lock | PASS | C4.10 lock, recovery, direct navigation and reload | — |
| RF-27 | Responsive smoke | PASS | Full E2E Chromium 320/768/1440, primary flows | — |
| RF-28 | Keyboard smoke | PASS | Shell/forms/dialog/focus/Escape E2E coverage | — |
| RF-29 | Refresh/reopen/persistence | PASS | OPFS/IndexedDB persistence and 100k synthetic records | — |

No flow was marked N/A: all requested product surfaces are implemented in the current baseline
and have corresponding E2E or prior C4 real-flow evidence. The dataset is synthetic, isolated
and test-created; no real user financial data was used.

## Test execution

- Targeted real-flow regression: `pnpm exec playwright test` on the ten C4 flow specs,
  `83 passed`, `91 skipped`, `0 failed`.
- Full E2E: `pnpm test:e2e`, `433 passed`, `233 skipped`, `0 failed` on 666 tests.
- Quality gate: `pnpm verify`, format/lint/typecheck/build PASS; Vitest `633 passed`, `4 skipped`.
- `pnpm manifest:check`: PASS.
- Browser/runtime observations: no test failure, crash, unhandled rejection or failed resource
  was surfaced by the verified flows. Known non-blocking output: jsdom `scrollTo()` notice and
  Vite chunk-size advisory.

## Critical-flow decision

Transfers remained balanced and neutral in income/expense reporting; import re-run was
idempotent; undo was batch-scoped; backup/restore returned the ledger to dataset A; persistence
survived reload/reopen. No P0/P1/P2 finding was opened and no accounting invariant changed.

**12.5.E.2 = PASS**

Next: `12.5.E.3 — Data Integrity & Recovery Final Gate` (not started).
`12.5.F`, Phase 13 and new features remain out of scope.
