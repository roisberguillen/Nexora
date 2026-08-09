# Current task

- Task: Phase 12.2 expense behavior classification and recurring-model alignment
- Roadmap phase: Phase 12, second vertical slice
- Category: persistence / domain / UI component (escalated from initial STANDARD route)
- Profile: ADVANCED
- Data risk: low; existing `categoryId` values and transactions are preserved without migration
- Status: complete; baseline formatting and the dedicated Phase 12.2 correction were validated
  before publication.
- Decision: an optional expense-only Transaction classification keeps variability (`fixed` or
  `variable`) and exceptionality (`ordinary` or `extraordinary`) separate from Category. A
  recurring schedule remains represented only by `RecurringRule`; no duplicate recurring flag or
  fragile transaction-to-rule reference is introduced in this slice.
- Next task: Phase 12.3 may consider advanced recurrence frequencies and durable rule lineage under
  a dedicated data-contract ADR. It has not started.
