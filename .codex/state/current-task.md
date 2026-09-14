# Current task

- Task: PMA-2 — ledger host e bridge sicuro Android
- Roadmap phase: PMA-2
- Status: `PMA2_3_COMPLETE_NEXT_PMA3` — PMA-2.3 applica payload tipizzati `transaction` e `transfer` alla stessa transazione SQLite del phone-host; importi minor-unit, foreign key, check e trigger trasferimenti proteggono l’atomicità. Test desktop e gate fisico Pixel 9 verdi.
- Evidence: `docs/ROADMAP_PHONE_LOCAL_HUB.md`; `apps/local-hub/src/sqlite_sync.rs`; `apps/local-hub/src/lib.rs`; `apps/web/src-tauri/src/lib.rs`; `.codex/state/test-evidence.md`.
- Next task: PMA-3 — discovery, pairing e autorizzazione dal telefono; non usare dati finanziari reali nel gate.
