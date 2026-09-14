# Current task

- Task: PMA-1 — runtime host Android foreground e loopback
- Roadmap phase: PMA-0
- Status: `PMA1_IN_PROGRESS` — contratto PMA-0 pubblicato; Android arm64 Tauri build baseline verificata con APK/AAB debug, guardia stop su WebView hidden e preflight permessi/ADB verificati. Restano aperti prova fisica della nuova build firmata, binding LAN/TLS e verifica stop/restart sul dispositivo.
- Evidence: `docs/ROADMAP_PHONE_LOCAL_HUB.md`; `apps/web/src-tauri/src/lib.rs`; `apps/web/src/settings/pcManagerDesktop.ts`; `.codex/state/test-evidence.md`.
- Next task: completare PMA-1 — runtime host Android lifecycle, binding e permessi minimali.
