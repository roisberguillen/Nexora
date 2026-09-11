# Current task

- Task: FIX.10 — Device Gate Pixel 9
- Roadmap phase: FIX.10
- Status: `IN PROGRESS` — export nativo Android corretto con dialogo Salva con nome e filesystem Tauri; debug Pixel 9 ha creato un file pubblico, verificato checksum e completato restore con checkpoint. Import preview, risoluzione conto, deduplica e offline locale verificati; release signed post-fix ricostruita, verificata con `apksigner`, installata sul Pixel 9 e avviata senza errori di bootstrap/crash. Sul debug batch sintetico `committed → undone` verificato; resta da ottenere una nuova traccia device completa commit + verifica ledger + undo.
- Evidence: `.codex/state/test-evidence.md`; `docs/ROADMAP_STABILIZATION.md`.
- Next task: completare sul Pixel 9 il flusso import sintetico con commit, verifica della riga persistita e undo senza cancellare dati.
