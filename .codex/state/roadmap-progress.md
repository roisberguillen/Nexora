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
| 12.5.C2.1 | complete | evidence and state aligned; banking shell foundation closed |
| 12.5.C2.2 | complete / functionally covered | existing verified behavior covers the slice; no new completion claim added |
| 12.5.C2.3 | complete | closure demonstrated by subsequent C2.7/C2.8 evidence for list, detail, form, responsive and accessibility |
| 12.5.C2.4 | complete | evidence recorded in the phase review and test evidence |
| 12.5.C2.5 | complete | evidence recorded in the phase review and test evidence |
| 12.5.C2.6-R | complete | transfer editing blocker resolved and verified |
| 12.5.C2.7 | complete | Mobile Banking UX Movimenti closed with `UI_REVIEW_PASS`, all required gates green and zoom 200% verified |
| 12.5.C2.8 | complete | UI hardening, accessibilità, stati, double-submit e responsive verification |
| 12.5.C2.9 | complete | Final Transactions Gate PASS; Movimenti frozen after the C2 sequence |
| 12.5.C2 | complete | final Transactions Gate PASS; Movimenti frozen |
| 12.5.C3.0 | complete | full Mobile/Desktop screen audit framework prepared |
| 12.5.C3.1 | complete | App Shell + Navigation `SCREEN_AUDIT_PASS`; focus management and responsive evidence closed |
| 12.5.C3.2 | complete | Global Search `SCREEN_AUDIT_PASS`; mobile/desktop, keyboard, zoom and responsive evidence closed |
| 12.5.C3.3 | complete | Dashboard/Home `SCREEN_AUDIT_PASS`; R2 monthly overview plus R3 financial-correctness hardening, overlap-safe budget summary, responsive states, accessibility and zoom evidence closed |
| 12.5.C3.4 | complete | Accounts / Conti `SCREEN_AUDIT_PASS`; list/editor, CRUD, archive/delete rules, responsive and accessibility evidence closed |
| 12.5.C3.5 | complete | Transactions regression `SCREEN_AUDIT_PASS`; Movimenti frozen after six-viewport regression and gate closure |
| 12.5.C3.6 | complete | Budget `SCREEN_AUDIT_PASS`; mobile/desktop, period, thresholds, hierarchy and financial propagation verified; Budget frozen |
| 12.5.C3.7–C3.21 | pending | subsequent screen-by-screen audits; C3.7 Recurring + Allocations is next |
| C4 | pending | real complete flows |
| C5 | pending | cross-surface consistency |
| D | pending | final independent review |
| E | pending | final gate: READY / NOT READY |
| F | pending | release freeze |
| 12.5.C4 | planned | real complete flows |
| 12.5.C5 | planned | cross-surface consistency |
| 12.5.D | planned | final independent review |
| 12.5.E | planned | final gate: READY / NOT READY |
| 12.5.F | planned | release freeze |
| 13 | pending | desktop delivery only after 12.5.F; not started |
| 14–17 | planned | no completion claim |

The 12.5.C2 sequence is authoritative for the completed banking UX checkpoint. C2 and C3.0 are
complete; C3.1, C3.2, C3.3, C3.4, C3.5 and C3.6 are complete, while C3.7–C3.21 and C4–F remain
pending until their own evidence exists.
Phase 13 must not be treated as next before
the 12.5 release freeze.

Recovery checkpoint: `backup/pre-phase-12.3-worktree-20260809` at `862c2a7` is frozen and is not
an approved implementation. The Phase 12.3 work was recovered selectively on
`feature/phase-12.3` and then merged through PR #3; the checkpoint itself remains frozen.
