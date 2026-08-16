# Current task

- Task: Phase 12.5.C desktop UX menu and transactions review.
- Roadmap phase: Phase 12 remains complete. This UI task does not authorize a financial-domain,
  repository or database change.
- Status: incomplete on 2026-08-16. Menu grouping/collapse, local transaction filters and editing
  of eligible manual movements are verified. Editing movements with persistent splits remains P1
  because their replacement must preserve split/tag details atomically.
- Baseline: `e7de11d` on `codex/phase-12-5-0-checkpoint`.
- Next task: implement atomic replacement of an eligible transaction with its split/tag details
  across all ledger adapters before declaring Phase 12.5.C complete.
