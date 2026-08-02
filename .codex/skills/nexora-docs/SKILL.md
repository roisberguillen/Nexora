---
name: nexora-docs
description: Update Nexora authoritative documentation, roadmap evidence, ADRs, changelog and persistent orchestration state without duplicating stable context. Use after verified behavior changes, decisions, phase progress or documentation-only tasks.
---

# Nexora Docs

1. Route documentation-only work as ECONOMY unless runtime behavior or architecture conflicts.
2. Update the authoritative source identified by `docs/CURRENT_SOURCES.md`; link instead of copying.
3. Keep roadmap status evidence-based and never mark a partial phase complete.
4. Put architectural decisions in ADRs or `DECISIONS_LOG.md`, task facts in `.codex/state`.
5. Update `CHANGELOG.md` only for completed user-visible or milestone changes.
6. Run formatting and `pnpm codex:validate` before publishing documentation changes.
