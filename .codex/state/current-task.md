# Current task

- Task: PMA-3.2 — Local Hub LAN del telefono e menu semplificato
- Roadmap phase: PMA-3
- Status: `PMA3_2_CODE_COMPLETE_DEVICE_GATE_PENDING` — Android rileva l’indirizzo LAN, genera un certificato TLS temporaneo per l’avvio esplicito del Local Hub Wi-Fi e la UI mostra URL/stato senza passcode sessione. Pairing e autorizzazione backend restano fail-closed.
- Evidence: `docs/ROADMAP_PHONE_LOCAL_HUB.md`; `apps/web/src-tauri/src/lib.rs`; `apps/web/src/settings/SettingsPage.tsx`; `.codex/state/test-evidence.md`.
- Next task: eseguire verify/UI review, build signed e gate Pixel/PC sulla stessa Wi-Fi; nessun dato finanziario reale.
