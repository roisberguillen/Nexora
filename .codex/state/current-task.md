# Current task

- Task: PMA-2 — ledger host e bridge sicuro Android
- Roadmap phase: PMA-2
- Status: `PMA2_3_CODE_COMPLETE_DEVICE_GATE_PENDING` — PMA-2.3 applica ora payload tipizzati `transaction` e `transfer` alla stessa transazione SQLite del phone-host; importi minor-unit, foreign key, check e trigger trasferimenti proteggono l’atomicità. Test/gate desktop verdi; resta il build/install Android aggiornato e il gate fisico.
- Evidence: `docs/ROADMAP_PHONE_LOCAL_HUB.md`; `apps/local-hub/src/sqlite_sync.rs`; `apps/local-hub/src/lib.rs`; `apps/web/src-tauri/src/lib.rs`; `.codex/state/test-evidence.md`.
- Next task: compilare/installare la build PMA-2.3 sul Pixel, ripetere health/start/stop/background e poi chiudere PMA-2.3; solo dopo passare al prossimo slice autorizzato.
