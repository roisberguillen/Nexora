# Current task

- Task: Phase 12.3 advanced recurring schedules and financial calendar
- Roadmap phase: Phase 12, third vertical slice
- Category: domain / persistence / calendar / responsive UI
- Profile: ADVANCED
- Data risk: medium; migration v17 is additive and preserves existing rules, transactions and
  backups.
- Status: complete and merged to `main` through PR #3. The merge commit `0ea79e8` and its GitHub
  Actions `verify` job are green.
- Decision: `RecurringRule` now owns deterministic weekly, monthly and annual schedule data with
  separate nominal and effective dates. It does not automatically create Transactions; durable
  occurrence confirmation, skip and transaction lineage remain a future dedicated slice.
- Next task: Phase 13 platform delivery may be planned, but has not started.
