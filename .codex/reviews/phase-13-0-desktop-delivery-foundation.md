# 13.0 — Desktop Delivery Foundation

Data: 2026-09-07
Branch: `codex/phase-12-5-0-checkpoint`
Baseline: `4b40b7d` (`test(release): freeze phase 12.5`)

## Scope

Prima slice desktop autorizzata dopo il release freeze 12.5. Verificata la fondazione Tauri 2
Windows/macOS condivisa: shell React/Vite, adapter SQLite nativo, bootstrap nativo e startup.
Nessuna nuova feature finanziaria, schema o migrazione è stata introdotta.

## Gate matrix

| Gate | Result | Evidence |
| --- | --- | --- |
| Native adapter tests | PASS | `pnpm test -- packages/database-tauri/src`: 5 passed |
| Rust locked check | PASS | `cargo check --locked` in `apps/web/src-tauri` |
| Web production build | PASS | Tauri `beforeBuildCommand`, Vite/PWA build |
| Tauri desktop build | PASS | `pnpm --filter @nexora/web tauri:build` (`--no-bundle`) |
| Desktop executable | PASS | `target/release/nexora.exe` produced |
| Desktop startup smoke | PASS | executable alive after 5 seconds, then cleanly stopped |
| Native persistence contract | PASS | `openTauriLedger`, shared migration catalog and SQLite repository |
| Security boundary | PASS | relative private `sqlite:nexora.db`; no new capability or permission |

Known non-blocking advisory: Vite chunk-size warning. No P0/P1/P2 findings, no signing
credentials needed for this no-bundle validation, and no user data was accessed.

**13.0 FOUNDATION = COMPLETE / PASS**

Next: `13.1 — Desktop shell and native persistence parity` (not started).
