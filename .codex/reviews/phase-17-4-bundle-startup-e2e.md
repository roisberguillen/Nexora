# 17.4 — Bundle/startup performance, platform regressions and full E2E

- Date: 2026-09-08
- Router: `ui_component / ADVANCED / low`

## Evidence

- The production preview bundle started successfully through the Playwright web server.
- `pnpm exec playwright test --workers=8`: 420 passed, 233 skipped, 13 timeouts under parallel contention.
- `pnpm exec playwright test --last-failed --workers=1`: 13 passed, 0 failed.
- The serial retry covered the exact failed C4 flows across the affected 320, 375, 390, 768, 1024 and 1440 viewport projects.
- No code, schema, storage, ledger or accounting invariant was changed.

## Findings

P0: None.

P1: None.

P2: None. The parallel-only timeouts are documented as test-runner contention and did not reproduce serially.

Gate result: PASS.
