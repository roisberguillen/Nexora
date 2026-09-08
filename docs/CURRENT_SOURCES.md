# Fonti autorevoli correnti

Usare questa mappa dopo il router; non aprire tutte le fonti per ogni task.

| Ambito | Fonte primaria | Fonti di dettaglio |
|---|---|---|
| Contesto e prodotto | `CONTEXT.md`, `PRD.md` | ADR di dominio pertinenti |
| Architettura | `ARCHITECTURE.md` | `PLATFORM_MATRIX.md`, ADR 0001–0018 |
| Dati e invarianti | `DATA_MODEL.md` | ADR 0003–0014 |
| Evoluzione attiva | `ROADMAP_UI_ARCHITECTURE.md`, `ROADMAP_STABILIZATION.md` | `.codex/state/roadmap-progress.md`, `.codex/state/current-task.md` |
| Baseline RC precedente | `ROADMAP.md` | report archiviati; non guida le nuove fasi |
| UI e layout | `ux/MOCKUP_INTEGRATION.md`, `ux/UI_UX_CHANGE_MANIFEST.md`, `ux/C3_SCREEN_AUDIT_FRAMEWORK.md`, `ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`, ADR 0019 | mockup Stitch ufficiale e controllo obbligatorio per ogni modifica |
| Backup | ADR 0011, 0015 e 0018 | file `.nexora` e cartella Google Drive scelta dall'utente |
| Local Hub e sync | ADR 0016 | specifiche sync correnti; separato dal backup |
| Lavoro Codex | `../AGENTS.md`, `.codex/orchestration/routing-policy.yaml` | skill e stato `.codex` pertinenti |

Il mockup legacy non è una fonte. I riferimenti storici a destinazioni eliminate descrivono solo
decisioni di esclusione e non autorizzano implementazioni operative.
