# Current task

- Task: FIX.10 — Device Gate Pixel 9
- Roadmap phase: FIX.10
- Status: `COMPLETE` — export nativo Android corretto con dialogo Salva con nome e filesystem Tauri; debug Pixel 9 ha creato un file pubblico, verificato checksum e completato restore con checkpoint. Import preview, risoluzione conto, deduplica e offline locale verificati; release signed post-fix ricostruita, verificata con `apksigner`, installata sul Pixel 9 e avviata senza errori di bootstrap/crash. Sul debug Pixel 9 una riga sintetica unica è stata contabilizzata, verificata nei Movimenti e annullata senza cancellazione fisica: batch `committed → undone`, movimento `Annullato · Importato`.
- Evidence: `.codex/state/test-evidence.md`; `docs/ROADMAP_STABILIZATION.md`.
- Next task: FIX.11 — gate E2E Android/Desktop e chiusura stabilizzazione.
