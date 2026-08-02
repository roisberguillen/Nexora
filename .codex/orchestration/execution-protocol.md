# Execution protocol

For every atomic roadmap task:

1. Run `pnpm codex:route --task "..."` and publish its header.
2. Confirm the real roadmap state and acceptance evidence.
3. Write a bounded plan and create a checkpoint before CRITICAL or data-changing work.
4. Read only the repository-map entries and authoritative files needed by the route.
5. Implement one vertical slice without unrelated cleanup.
6. Run levels 1–2 immediately; correct within the attempt budget.
7. Run the configured final gate, update state, evidence, changelog and roadmap.
8. Commit the completed slice separately and push only after the required gates pass.
9. Route the next incomplete atomic task.

Never delete local user data, silently choose between ledgers, weaken financial invariants or claim
a partially verified phase is complete.
