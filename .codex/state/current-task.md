# Current task

- Task: Phase 12.5.1 real-source mapping, read-only
- Roadmap phase: Phase 12 is complete; this validation sub-phase does not modify the ledger.
- Status: complete on 2026-08-15. Mediobanca CSV, N26 PDF and the usable 11-column/45-source-row
  Money Manager workbook were structurally analysed. The sanitised report records explicit account,
  date, currency, category and transfer rules without retaining real row data.
- Baseline: checkpoint `fe7dc1aa963113f739ad3115f8d352cc930ed95e` on
  `codex/phase-12-5-0-checkpoint`; no real account, import batch or financial record was created.
- Next task: Phase 12.5.2 only after authorization. It must implement and verify the explicit
  mapping/preview gates documented in the report; do not start 12.5.3, 12.5.4, 12.5.5, 12.5.6 or
  Phase 13 implementation.
