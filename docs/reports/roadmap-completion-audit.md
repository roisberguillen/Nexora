# Audit di completamento — roadmap ripristino e test completi

Data: 2026-07-30

Questo documento confronta la roadmap richiesta con le evidenze verificabili presenti nel
repository. Un check verde non equivale a copertura totale di uno step.

| Step | Stato | Evidenza | Gap da chiudere |
|---|---|---|---|
| 0 — Baseline | Parziale | `startup-baseline.md`, `pnpm doctor`, gate verdi | Non è conservata la prova storica del test inizialmente rosso. |
| 1 — Discovery | Coperto | capability OPFS unificate, test startup e fallback | Ripetizione parametrica dieci volte non è esplicitamente rendicontata. |
| 2 — Fallback | Parziale | fallback OPFS→IndexedDB, 50 reload, preferenze sicure | Mancano dieci abort simulati durante apertura. |
| 3 — Startup | Parziale | orchestratore, progress, timeout, Web Locks e multi-tab | Retry transitorio e StrictMode richiedono evidenza E2E diretta. |
| 4 — Recovery | Parziale | verifica backup e restore temporaneo isolato | La copia non è navigabile come sessione separata; manca matrice completa errori. |
| 5 — Atomicità | Parziale | rollback browser reale IndexedDB e OPFS | Non ogni comando e combinazione seriale/concorrenza è provata sui backend reali. |
| 6 — Suite funzionale | Parziale | suite unit/E2E esistente, 295 test e 120 E2E | La matrice completa con ripetizioni e volumi per ogni dominio non è coperta. |
| 7 — Stress backend | Parziale | 100k IndexedDB e OPFS, risultati registrati | Dataset incompleto, campagne ripetute, memoria e rendering non misurati. |
| 8 — Resilienza | Parziale | 50 reload, cinque schede | Quota, chiusura in scrittura/import/backup, worker terminato e SW update mancanti. |
| 9 — Backup/restore | Parziale | backup cifrato e restore locale/temporaneo | Restore incrociato ripetuto, digest completo e casi d'errore mancanti. |
| 10 — UI/accessibilità | Parziale | axe shell, screenshot desktop, viewport 320–1440, paginazione Movimenti a 100 righe | Caricamento backend, altre liste, zoom 200% e audit di tutte le pagine mancanti. |
| 11 — PWA | Parziale | offline e persistenza OPFS/IndexedDB | installazione e aggiornamento sicuro del service worker mancanti. |
| 12 — Sicurezza | Parziale | audit dipendenze, CSP/COOP/COEP e diagnostica | import/export malevoli e formula injection da verificare in modo esplicito. |
| 13 — Gate finale | Parziale | verify, E2E, manifest e audit verdi | Non può chiudersi finché i gap precedenti restano aperti. |

## Decisione di stato

La roadmap non è completata. I prossimi blocchi prioritari sono: resilienza a quota/interruzione,
backup-restore cross-backend con digest, virtualizzazione delle liste grandi e campagna PWA update.
La sincronizzazione PC-smartphone è fuori dall'architettura PWA locale corrente e richiede una
roadmap separata con protocollo, autorizzazione e gestione conflitti.
