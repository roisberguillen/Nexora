# Current task

- Task: Phase 12.5.C2.5 banking-style income and expense transaction form.
- Roadmap phase: UI-only redesign of the shared manual transaction form. It does not authorize
  financial-domain, persistence, query, transfer, split, validation or command changes.
- Status: complete on 2026-08-18. The standalone new-movement flow has a banking hierarchy for
  income and expense (type, amount, account, counterparty, category, date and description) with
  a closed-by-default `Altri dettagli` disclosure for split, tags, status and expense properties.
  Amount parsing, signed minor units, validation, command mapping and the existing transfer flow
  remain unchanged. Targeted component tests cover income and expense creation; the complete unit,
  formatting, lint, typecheck, build, manifest and orchestration checks pass. Split and financial
  details pass in the browser at 320, 390, 768, 1024 and 1440 px.
- Baseline: `b0972b1` on `codex/phase-12-5-0-checkpoint`.
- Next task: 12.5.C2.6.
