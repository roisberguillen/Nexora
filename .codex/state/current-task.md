# Current task

- Task: Phase 12.4.1 recurring monthly budgets with effective-dated revisions
- Roadmap phase: Phase 12, fourth vertical slice follow-up
- Category: domain / persistence / notifications / responsive UI
- Profile: ADVANCED
- Data risk: medium; migration v19 is additive, transforms legacy month rows non-destructively and
  requires a verified checkpoint for an existing SQLite ledger.
- Status: in progress on `feature/phase-12.4-recurring-budgets`.
- Decision: budgets use the existing category hierarchy and actual booked/reconciled expenses only;
  macro aggregation, split attribution and duplicate prevention are implemented in a shared
  non-React selector. New budgets require two user-chosen ordered alert percentages; the current
  period is assigned by the application layer and is not exposed in the form.
- Next task: validation and release of this vertical slice. Phase 13 is not started.
