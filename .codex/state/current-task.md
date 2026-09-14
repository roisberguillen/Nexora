# Current task

- Task: PMA-2 — ledger host e bridge sicuro Android
- Roadmap phase: PMA-2
- Status: `PMA2_2_COMPLETE_NEXT_PMA2_3` — slice 2.2 completata: bootstrap autenticato del log durevole, payload ledger tipizzato/allowlistato, validazione atomica e rollback su payload invalido; APK release firmato/installato e gate fisico Pixel 9 superato. PMA-2 resta aperta per l’applicazione diretta alle tabelle ledger e le invarianti di dominio.
- Evidence: `docs/ROADMAP_PHONE_LOCAL_HUB.md`; `apps/local-hub/src/sqlite_sync.rs`; `apps/local-hub/src/lib.rs`; `apps/web/src-tauri/src/lib.rs`; `.codex/state/test-evidence.md`.
- Next task: PMA-2.3 — applicare i payload validati al bridge ledger nativo con transazione atomica, invarianti Money/trasferimenti e test di recovery; poi aggiornare Android e ripetere il gate fisico.
