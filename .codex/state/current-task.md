# Current task

- Task: Phase 12.5 allocation plans
- Roadmap phase: Phase 12, fifth vertical slice
- Category: domain / persistence / responsive UI / backup compatibility
- Profile: CRITICAL
- Data risk: medium; existing allocation plans and confirmed transfers must remain readable and
  no confirmation may duplicate a transfer.
- Checkpoint: `.codex/state/checkpoints/2026-08-11-phase-12-5-allocation-plans.md`
- Status: implementation and verification in progress; Phase 12 remains in progress and Phase 13
  is not started.
- Decision: keep allocation plans in `#recurring`; each transfer remains atomic as defined by ADR
  0014, while an execution identifier makes retried confirmations idempotent per plan.
- Next task: close 12.5 only after PR and `main` CI are green.
