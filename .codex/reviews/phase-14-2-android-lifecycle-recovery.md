# 14.2 — Android persistence, lifecycle, startup and recovery

Result: `COMPLETE / PASS`

Android uses the generated Tauri `TauriActivity` lifecycle through the minimal
`MainActivity`; no divergent native persistence lifecycle was introduced. The shared React
bootstrap selects native SQLite in Tauri, applies the startup lock, exposes recovery diagnostics
and closes the ledger on unmount. This slice verifies that existing contract rather than adding
an unproven Android-specific handler.

| Check | Result | Evidence |
|---|---|---|
| Android activity baseline | PASS | Generated `MainActivity` delegates to TauriActivity after edge-to-edge setup. |
| Native startup selection | PASS | Existing `main.tsx` native branch calls `openTauriLedger()` under startup lock. |
| Startup/recovery behavior | PASS | 18 files / 72 tests passed across startup, persistence, reset and native adapter suites. |
| Type safety | PASS | Web and database-tauri typechecks passed. |
| Android packaging baseline | PASS | 14.0 Gradle arm64 debug APK packaging passed. |
| Financial invariants | PASS | No schema, ledger or accounting behavior changed. |

P0: 0  
P1: 0  
P2: 0

Evidence commands:

- `pnpm test -- apps/web/src/startup apps/web/src/persistence apps/web/src/reset packages/database-tauri/src`
  → 18 files / 72 tests passed.
- `pnpm --filter @nexora/web typecheck` and `pnpm --filter @nexora/database-tauri typecheck` → PASS.

Next: `14.3 — Responsive mobile UI and least-privilege file/document picker workflows`.
