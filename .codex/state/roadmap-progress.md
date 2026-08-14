# Roadmap progress

Authoritative roadmap: `docs/ROADMAP_UI_ARCHITECTURE.md`.

| Phase | Verified state | Evidence location |
|---|---|---|
| 0–6 | complete | roadmap evidence sections |
| 7 | complete | roadmap Phase 7 evidence; native schema 13 verification |
| 8 | complete | roadmap Phase 8 evidence and phase audit |
| 9 | complete | roadmap Phase 9 evidence and shared engine tests |
| 10 | complete | roadmap Phase 10 evidence; manual file workflow and browser tests |
| 11 | complete | configured tests plus authorized live consent, upload, reread, read-only verification, restore and ledger reopen |
| 12 | complete — 2026-08-14 | all roadmap-assigned financial/UI surfaces audited against code, documentation and CI on `4ab136e`; no Phase 12 P0/P1 remains |
| 12.1 | complete | hierarchical financial categories, published and verified |
| 12.2 | complete | expense behavior classification and recurring-model alignment, including final form corrections |
| 12.3 | complete | advanced calendar, additive migration v17, SQLite/IndexedDB parity, portable backup compatibility and responsive UI; merged via PR #3 with GitHub Actions green on `main` (`0ea79e8`) |
| 12.4 | complete | hierarchical budget CRUD, macro/subcategory scope, split-safe progress, responsive UI and adapter parity; merged via PR #4 with GitHub Actions green on `main` (`e9b4d3f`) |
| 12.4.1 | complete | recurring effective-dated monthly budget revisions, migration v19, historical month navigation and GitHub `verify` green; merged via PR #6 (`5efc529`) |
| 12.5 | complete | allocation plan CRUD, confirmed idempotent execution, backup/reset compatibility and responsive UI; merged via PR #7 with GitHub `verify` green on `main` (`3edeabb`) |
| 12.A–E | complete | CI/manifest repair, investment repository integrity, removal of unsafe investment CSV import, Europe/Rome civil-date defaults and final automated coverage; GitHub CI green on `main` (`4ab136e`) |
| 13 | next | platform delivery only after Phase 12 closes; not started |
| 14–17 | planned | no completion claim |

Recovery checkpoint: `backup/pre-phase-12.3-worktree-20260809` at `862c2a7` is frozen and is not
an approved implementation. The Phase 12.3 work was recovered selectively on
`feature/phase-12.3` and then merged through PR #3; the checkpoint itself remains frozen.
