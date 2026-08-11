# Current task

- Task: Phase 12.4.1 recurring monthly budgets with effective-dated revisions
- Roadmap phase: Phase 12, fourth vertical slice follow-up
- Category: domain / persistence / notifications / responsive UI
- Profile: ADVANCED
- Data risk: medium; migration v19 is additive, transforms legacy month rows non-destructively and
  requires a verified checkpoint for an existing SQLite ledger.
- Status: complete; merged through PR #6 as `5efc529` after the full GitHub `verify` gate.
- Decision: budgets use the existing category hierarchy and actual booked/reconciled expenses only;
  macro aggregation, split attribution and duplicate prevention are implemented in a shared
  non-React selector. New budgets require two user-chosen ordered alert percentages; the current
  period is assigned by the application layer and is not exposed in the form.
- Next task: remaining scoped work of Phase 12 only. Phase 13 is not started.
