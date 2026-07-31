# Inventario funzionale e di interfaccia

Stato iniziale della Fase 0. La Fase 1 completa la matrice dettagliata schermata → route → query
→ command → repository, usando le 98 schermate Stitch come riferimento.

| Area | Route/superficie corrente | Stato Fase 0 | Destinazione |
|---|---|---|---|
| Avvio e sicurezza | bootstrap, app lock, recovery | esistente da rifattorizzare | Fase 5 |
| Shell e navigazione | App shell, header, sidebar/bottom nav | esistente da rifattorizzare | Fase 4 |
| Dashboard | `#overview` | esistente da rifattorizzare | Fase 6 |
| Conti | `#accounts` | esistente da rifattorizzare | Fase 6 |
| Movimenti | `#transactions` | esistente da rifattorizzare | Fase 6 |
| Import/export | `#imports`, `#exports` | esistente incompleto | Fase 8 |
| Backup | `#backup` | esistente, percorso NAS da eliminare | Fasi 2, 9–11 |
| Pianificazione | budget, ricorrenze, allocazioni | esistente da rifattorizzare | Fase 12 |
| Patrimonio | prestiti, investimenti | esistente da rifattorizzare | Fase 12 |
| Analisi e diario | analytics, journal | esistente da rifattorizzare | Fase 12 |
| Organizzazione | categorie, tag, cestino | esistente da rifattorizzare | Fase 12 |
| Profilo e impostazioni | profile, settings, privacy | esistente da rifattorizzare | Fase 12 |
| Piattaforme native | Tauri desktop/Android | nuova | Fasi 7, 13, 14 |
| Sincronizzazione | Nexora Local Hub | nuova, sostituisce local-host Node | Fasi 15–16 |

Le schermate prive di feature o contratto dati non sono autorizzate in produzione; eventuali
duplicati vengono consolidati nella Fase 1.
