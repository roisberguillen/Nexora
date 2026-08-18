# Current task

- Task: Phase 12.5.C2.4 chronological grouping and transaction detail.
- Roadmap phase: UI-only representation slice for `#transactions`; it does not authorize
  financial-domain, persistence, query, filter, KPI or command changes.
- Status: complete on 2026-08-18. The local implementation adds chronological date groups and an
  accessible transaction-detail surface using only the existing view model. It also restores route
  transitions into and out of the existing standalone movement editor. Targeted component checks,
  formatting, lint, typecheck, full unit suite, build, manifest and orchestration validation pass.
  Transfer, split and financial-detail flows pass on all configured browser viewports.
- Baseline: `b0972b1` on `codex/phase-12-5-0-checkpoint`.
- Next task: 12.5.C2.5.
