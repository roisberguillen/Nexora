# Current task

- Task: PMA-2 — ledger host e bridge sicuro Android
- Roadmap phase: PMA-2
- Status: `PMA2_IN_PROGRESS` — slice 2.2 collegata: bootstrap autenticato del log durevole, payload ledger tipizzato/allowlistato, validazione atomica e rollback su payload invalido; applicazione diretta alle tabelle ledger resta aperta.
- Evidence: `docs/ROADMAP_PHONE_LOCAL_HUB.md`; `apps/local-hub/src/sqlite_sync.rs`; `apps/local-hub/src/lib.rs`; `apps/web/src-tauri/src/lib.rs`; `.codex/state/test-evidence.md`.
- Next task: completare PMA-2.2 — definire snapshot/bootstrap ledger e applicare operation payload in transazione atomica con invarianti Money/trasferimenti.
