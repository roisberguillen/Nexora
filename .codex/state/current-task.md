# Current task

- Task: Phase 12.5.1 real-source mapping, read-only
- Roadmap phase: Phase 12 is complete; this validation sub-phase does not modify the ledger.
- Status: blocked on 2026-08-15. Mediobanca CSV and N26 PDF were analysed; the supplied Money
  Manager workbook has no usable header or source row, so historical and Directa SIM mapping cannot
  be determined safely.
- Baseline: checkpoint `fe7dc1aa963113f739ad3115f8d352cc930ed95e` on
  `codex/phase-12-5-0-checkpoint`; no real account, import batch or financial record was created.
- Next task: obtain a usable Money Manager export, then resume Phase 12.5.1. Do not start 12.5.2,
  12.5.3, 12.5.4, 12.5.5, 12.5.6 or Phase 13 implementation.
