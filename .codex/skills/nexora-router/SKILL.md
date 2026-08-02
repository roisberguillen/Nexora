---
name: nexora-router
description: Classify every Nexora roadmap task into ECONOMY, STANDARD, ADVANCED or CRITICAL and apply repository context, test, attempt and escalation limits. Use before starting any Nexora phase, bug fix, implementation, review or documentation task.
---

# Nexora Router

1. Read `.codex/state/current-task.md`, `roadmap-progress.md` and `repository-map.md`.
2. Run `pnpm codex:route --task "..."` with phase, files or current profile when known.
3. Publish the complete compact routing header before editing.
4. Apply `.codex/orchestration/routing-policy.yaml`; never claim an unsupported model switch.
5. Create a checkpoint before CRITICAL or data-changing work.
6. Escalate after two failed attempts, unexpected scope growth or new data/security risk.
7. Update state and test evidence after important checkpoints; avoid repeating stable context.

Do not use sub-agents by default. Use at most the route limit and only when independent work or
review saves more context than coordination costs.
