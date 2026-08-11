# Current task

- Task: Phase 12.4 hierarchical budget management
- Roadmap phase: Phase 12, fourth vertical slice
- Category: domain / persistence / budget progress / responsive UI
- Profile: ADVANCED
- Data risk: medium; the existing budget schema is preserved and no new taxonomy will be created.
- Status: complete locally; awaiting pull request CI and integration into `main`.
- Decision: budgets use the existing category hierarchy and actual booked/reconciled expenses only;
  macro aggregation, split attribution and duplicate prevention are implemented in a shared
  non-React selector.
- Next task: remaining scoped work of Phase 12 only. Phase 13 is not started.
