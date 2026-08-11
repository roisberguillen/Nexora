# Current task

- Task: Phase 12.4 budget alert thresholds correction
- Roadmap phase: Phase 12, fourth vertical slice
- Category: domain / persistence / notifications / responsive UI
- Profile: ADVANCED
- Data risk: low; migration v18 is additive and preserves every existing budget and its legacy
  alert semantics.
- Status: complete and published on `feature/phase-12.4-budget-thresholds` as `16b9e3e`;
  draft PR #5 awaits CI and review before integration on `main`.
- Decision: budgets use the existing category hierarchy and actual booked/reconciled expenses only;
  macro aggregation, split attribution and duplicate prevention are implemented in a shared
  non-React selector. New budgets require two user-chosen ordered alert percentages; the current
  period is assigned by the application layer and is not exposed in the form.
- Next task: remaining scoped work of Phase 12 only. Phase 13 is not started.
