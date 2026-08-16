# Current task

- Task: Phase 12.5.C2.1 Movements page hierarchy and KPI.
- Roadmap phase: the user-requested UI slice follows the completed Phase 12.5.D review and is
  limited to the top of `#transactions`; it does not authorize financial-domain or persistence work.
- Status: complete on 2026-08-17. The page now exposes the Movimenti H1, the existing
  `#new-transaction` entry route and month-aware income, expense and net KPI from the existing
  cash-flow report. Transfers and cancelled transactions remain excluded by domain semantics.
- Baseline: `b0972b1` on `codex/phase-12-5-0-checkpoint`.
- Next task: 12.5.C2.2 — Ricerca bancaria + filtri rapidi, only on explicit request.
