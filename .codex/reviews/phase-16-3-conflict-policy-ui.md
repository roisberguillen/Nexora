# 16.3 — Explicit conflicts and review UI

- Data: 2026-09-08
- Router: `synchronization / CRITICAL / medium`
- Scope: explicit conflict record and deterministic manual policy in the sync contract, plus a visible review action in the shared UI package.
- Evidence: `apps/local-hub/src/lib.rs`, `packages/ui/src/SyncConflictBanner.tsx`, `docs/SYNC_SPEC.md`, ADR 0016.
- Safety: conflicts are not silently deleted, merged, overwritten or resolved through last-write-wins; the UI only invokes an explicit review callback.

## Findings

### P0

None.

### P1

None.

### P2

None.

## Verification

- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`: PASS.
- `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 20 passed, 0 failed.
- `pnpm --filter @nexora/ui typecheck`: PASS.
- `pnpm exec vitest run packages/ui/src/SyncConflictBanner.test.tsx`: 2 passed, 0 failed.
- Browser verification: no route or running application flow changed; the new shared component is covered by focused DOM tests and the UI integration surface remains for the subsequent sync slices.

## Conclusion

`SYNC_EXPLICIT_CONFLICTS_PASS` — 16.3 complete; next authorized task is 16.4.
