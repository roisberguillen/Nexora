---
name: nexora-testing
description: Select and execute risk-based progressive tests for Nexora changes, from scoped unit and type checks through E2E, performance, recovery and multiplatform gates. Use when planning validation, diagnosing failing gates or closing a task or phase.
---

# Nexora Testing

1. Derive the minimum level from the routed task.
2. Run level 1 package/file tests first, then feature/component integration at level 2.
3. Run lint, complete typecheck, unit tests and build at level 3 before a phase commit.
4. Add level 4 E2E, performance, recovery and platform builds only when route risk requires them.
5. Record commands, counts, skips and failures in `.codex/state/test-evidence.md`.
6. Never call a gate green when skips are unexplained or failures are hidden.

Reproduce first; change tests only when the approved behavior or harness is demonstrably wrong.
