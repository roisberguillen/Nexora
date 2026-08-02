# Escalation policy

Escalate one profile when two consecutive attempts fail, scope crosses more packages than planned,
data-loss risk appears, rollback is unavailable, unrelated tests fail, runtime behavior contradicts
authoritative documentation, architecture must change, security concerns emerge or reproduction is
nondeterministic.

If a required model/profile switch cannot be performed by the runtime:

1. Stop edits in a safe state.
2. Record analyzed files and tests in `current-task.md`.
3. Create a checkpoint with `pnpm codex:checkpoint`.
4. Fill `.codex/templates/escalation-request.md` with the required profile and reason.
5. Ask for the manual switch without naming unavailable models.
6. Resume from the checkpoint; do not restart repository discovery.

CRITICAL work also requires a threat analysis, negative/recovery tests and an independent review.
