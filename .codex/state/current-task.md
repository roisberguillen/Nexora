# Current task

- Task: FIX.10 — Device Gate Pixel 9
- Roadmap phase: FIX.10
- Status: `IN PROGRESS` — export nativo Android corretto con dialogo Salva con nome e filesystem Tauri; debug Pixel 9 ha creato un file pubblico, verificato checksum e completato restore con checkpoint. Import preview, risoluzione conto, deduplica e offline locale verificati; commit/undo import e release signed post-fix restano da chiudere.
- Evidence: `.codex/state/test-evidence.md`; `docs/ROADMAP_STABILIZATION.md`.
- Next task: rifare la release signed con le credenziali locali e chiudere il commit/undo import senza cancellare dati.
