# Current task

- Task: Money Manager semantic account/category/transfer/adjustment migration fix.
- Roadmap phase: Phase 12 remains complete. This corrective task does not start another roadmap
  phase or authorize the full-history migration.
- Status: complete locally on 2026-08-16. The supplied 45-row workbook passed read-only parsing,
  semantic planning, isolated in-memory commit, duplicate-only rerun and full undo. No real source
  row, amount, identifier, workbook or generated fixture was retained in Git.
- Baseline: published checkpoint `d07b327` on `codex/phase-12-5-0-checkpoint`.
- Next task: publish this verified correction, then wait for explicit authorization before any
  further real-data phase or full-history import.
