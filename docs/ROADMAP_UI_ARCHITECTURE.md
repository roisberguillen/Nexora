# Roadmap UI, architettura e multipiattaforma

Fonte: `NEXORA_ROADMAP_UI_ARCHITETTURA.md`, ricevuta il 31 luglio 2026. Questa roadmap sostituisce
le roadmap di evoluzione precedenti per le attività di UI, piattaforma, backup e sincronizzazione;
le invarianti finanziarie e le migrazioni già verificate restano vincolanti.

| Fase | Obiettivo | Stato |
|---|---|---|
| 0 | Congelamento delle specifiche | completata |
| 1 | Audit e mappatura del mockup | pianificata |
| 2 | Rimozione NAS e funzioni eliminate | pianificata |
| 3 | Fondamenta applicative | pianificata |
| 4 | Design system e App Shell | pianificata |
| 5 | Startup e stati trasversali | pianificata |
| 6 | Modulo pilota conti/movimenti/dashboard | pianificata |
| 7 | SQLite nativo multipiattaforma | pianificata |
| 8 | Importazione, esportazione e qualità dati | pianificata |
| 9 | Backup Engine indipendente | pianificata |
| 10 | Backup manuale | pianificata |
| 11 | Google Drive | pianificata |
| 12 | Feature finanziarie con nuova UI | pianificata |
| 13 | Applicazione Windows e macOS | pianificata |
| 14 | Applicazione Android | pianificata |
| 15 | Nexora Local Hub | pianificata |
| 16 | Sincronizzazione offline-first | pianificata |
| 17 | Hardening finale | pianificata |

Ogni fase si chiude solo con test proporzionati, aggiornamento documentale, commit Conventional
Commit e push su `origin/main`.

## Evidenze Fase 0

- [x] Archivio Stitch registrato tramite checksum e inventario 98 schermate/prototipi.
- [x] Palette, font e invarianti Nexora confermati come precedenti alla specifica visuale.
- [x] Policy backup fissata: file `.nexora` e Google Drive; nessun percorso NAS/SMB.
- [x] Target Tauri 2, SQLite nativo e Local Hub Rust fissati negli ADR 0017–0019.
- [x] Inventario funzionale, matrice piattaforme, strategia test, specifiche backup/sync e design
  congelati.
