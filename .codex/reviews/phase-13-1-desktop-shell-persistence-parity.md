# 13.1 — Desktop Shell and Native Persistence Parity

Data: 2026-09-07
Branch: `codex/phase-12-5-0-checkpoint`
Baseline: `649a419` (`test(desktop): verify phase 13 foundation`)

## Scope

Verifica della shell desktop Tauri e della parity del ledger SQLite nativo con i contratti
condivisi. Nessuna modifica a schema, migrazioni, path, permessi o feature finanziarie.

## Gate matrix

| Gate | Result | Evidence |
| --- | --- | --- |
| Adapter/migration/SQLite tests | PASS | 11 file, 76 passed, 0 failed |
| Locked native dependency check | PASS | `cargo check --locked` |
| Shared schema catalog | PASS | migration and repository parity tests |
| Tauri no-bundle build | PASS | `pnpm --filter @nexora/web tauri:build` |
| Native executable startup | PASS | `nexora.exe` alive after 5 seconds |
| Database path boundary | PASS | existing `sqlite:nexora.db` relative private URL contract |
| Financial invariants | PASS | shared repository tests; no transfer or amount behavior changed |

Build output contains only the known Vite chunk-size advisory and native linker warning.
No P0/P1/P2 findings, signing credentials, real ledger or user data were involved.

**13.1 = COMPLETE / PASS**

Next: `13.2 — Desktop packaging and distribution readiness` (not started).
