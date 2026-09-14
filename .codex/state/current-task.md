# Current task

- Task: PMA-2 — ledger host e bridge sicuro Android
- Roadmap phase: PMA-2
- Status: `PMA2_2_CODE_COMPLETE_DEVICE_GATE_BLOCKED` — slice 2.2 collegata: bootstrap autenticato del log durevole, payload ledger tipizzato/allowlistato, validazione atomica e rollback su payload invalido. La compilazione Rust Android è verde; il packaging APK release è bloccato dalla password keystore non disponibile in questo processo. Non avanzare a PMA-2.3 finché il retry firmato/installato sul Pixel non è verificato.
- Evidence: `docs/ROADMAP_PHONE_LOCAL_HUB.md`; `apps/local-hub/src/sqlite_sync.rs`; `apps/local-hub/src/lib.rs`; `apps/web/src-tauri/src/lib.rs`; `.codex/state/test-evidence.md`.
- Next task: ripetere il build APK release nella PowerShell dell'utente con `NEXORA_ANDROID_STORE_PASSWORD` e `NEXORA_ANDROID_KEY_PASSWORD`, installare con `adb install -r` e ripetere health/start/stop sul Pixel; solo dopo completare PMA-2.2 e passare a PMA-2.3.
