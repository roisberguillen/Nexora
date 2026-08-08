# Inventario funzionale e di interfaccia

Stato aggiornato alla Fase 1. La matrice dettagliata schermata → route → query → command →
repository, basata sulle 98 schermate Stitch, è in
[STITCH_SCREEN_MATRIX.md](ux/STITCH_SCREEN_MATRIX.md).

| Area | Route/superficie corrente | Stato Fase 0 | Destinazione |
|---|---|---|---|
| Avvio e sicurezza | bootstrap, app lock, recovery | esistente da rifattorizzare | Fase 5 |
| Shell e navigazione | App shell, header, sidebar/bottom nav | esistente da rifattorizzare | Fase 4 |
| Dashboard | `#overview` | esistente da rifattorizzare | Fase 6 |
| Conti | `#accounts` | esistente da rifattorizzare | Fase 6 |
| Movimenti | `#transactions` | esistente da rifattorizzare | Fase 6 |
| Import/export | `#imports`, `#exports` | esistente incompleto | Fase 8 |
| Backup | `#backup` | file portabile manuale e Drive; engine da rifattorizzare | Fasi 9–11 |
| Pianificazione | budget, ricorrenze, allocazioni | ricorrenze mensili con pausa/riattivazione/eliminazione confermata; frequenze avanzate pianificate | Fase 12 |
| Patrimonio | prestiti, investimenti | esistente da rifattorizzare | Fase 12 |
| Analisi e diario | analytics, journal | riepilogo puro della natura delle spese disponibile al dominio; visualizzazione avanzata pianificata | Fase 12 |
| Organizzazione | categorie, tag, cestino | esistente da rifattorizzare | Fase 12 |
| Profilo e impostazioni | profile, settings, privacy | esistente da rifattorizzare | Fase 12 |
| Piattaforme native | Tauri desktop/Android | nuova | Fasi 7, 13, 14 |
| Sincronizzazione | Nexora Local Hub | nuova, sostituisce local-host Node | Fasi 15–16 |

Le schermate prive di feature o contratto dati non sono autorizzate in produzione. La Fase 1 ha
consolidato gli stati in superfici esistenti: non vengono introdotte route duplicate per gli stati
Stitch o per le allocazioni finché non è dimostrata una necessità di navigazione.

I movimenti di spesa possono inoltre conservare opzionalmente variabilità (`fixed`/`variable`) ed
eccezionalità (`ordinary`/`extraordinary`), senza trasformare il nome di una categoria in una
regola contabile o temporale. Entrate, trasferimenti e rettifiche non espongono né accettano questi
attributi; una ricorrenza resta sempre una `RecurringRule` separata.
