# Current task

- Task: PC Manager PM-8 — gate reale Pixel 9 e desktop
- Roadmap phase: PM-8
- Status: `LAN_TLS_PROVISIONED_FIREWALL_BLOCKED` — Tauri pubblica il Local Hub su HTTPS LAN con certificato/chiave scelti dalla UI; health locale 200 e Pixel sulla stessa subnet verificati, ma il probe TCP dal Pixel è bloccato da una regola Windows `Nexora` in ingresso con azione `Block` sulla rete pubblica.
- Evidence: `docs/ROADMAP_PC_MANAGER.md`; `.codex/state/test-evidence.md`; bundle MSI/NSIS in `apps/web/src-tauri/target/debug/bundle/`.
- Next task: ottenere consenso amministrativo per una regola firewall privata/porta 43173, poi verificare browser LAN, pairing, sync e recovery sul Pixel; chiudere solo con evidenze reali.
