# Current task

- Task: Phase 12.2 expense behavior classification and recurring-model alignment
- Roadmap phase: Phase 12, second vertical slice
- Category: persistence / domain / UI component (escalated from initial STANDARD route)
- Profile: ADVANCED
- Data risk: low; existing `categoryId` values and transactions are preserved without migration
- Status: implemented; final repository-wide gates and dedicated publication in progress
- Decision: an optional expense-only Transaction classification keeps variability (`fixed` or
  `variable`) and exceptionality (`ordinary` or `extraordinary`) separate from Category. A
  recurring schedule remains represented only by `RecurringRule`; no duplicate recurring flag or
  fragile transaction-to-rule reference is introduced in this slice.
- Next task: complete the remaining Phase 12 financial features; a future 12.3 may consider
  advanced recurrence frequencies and durable rule lineage under a dedicated data-contract ADR.
