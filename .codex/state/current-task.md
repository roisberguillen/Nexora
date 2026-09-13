# Current task

- Task: PC Manager PM-8 — gate reale Pixel 9 e desktop
- Roadmap phase: PM-8
- Status: `TLS_RUNTIME_SLICE_PASS` — Local Hub loopback, pairing/sessione UI e ramo runtime HTTPS LAN fail-closed implementati e testati; Tauri resta loopback-only finché non esiste provisioning TLS esplicito.
- Evidence: `docs/ROADMAP_PC_MANAGER.md`; `.codex/state/test-evidence.md`; bundle MSI/NSIS in `apps/web/src-tauri/target/debug/bundle/`.
- Next task: definire/provare provisioning TLS e configurazione LAN reale, poi verificare browser LAN, sync e recovery sul Pixel; chiudere solo con evidenze reali.
