# Current task

- Task: FIX.10 — Device Gate Pixel 9
- Roadmap phase: FIX.10
- Status: `IN PROGRESS` — export nativo Android corretto con dialogo Salva con nome e filesystem Tauri; debug Pixel 9 ha creato un file pubblico, verificato checksum e completato restore con checkpoint. Import preview, risoluzione conto, deduplica e offline locale verificati; release signed post-fix ricostruita e verificata con `apksigner`. Restano da chiudere installazione/launch sul Pixel 9 rilevato da ADB e commit/undo import.
- Evidence: `.codex/state/test-evidence.md`; `docs/ROADMAP_STABILIZATION.md`.
- Next task: collegare nuovamente il Pixel 9 con Debug USB attivo, installare la release signed post-fix e chiudere il commit/undo import senza cancellare dati.
