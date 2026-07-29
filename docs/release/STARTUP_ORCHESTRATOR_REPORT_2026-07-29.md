# Startup Orchestrator — report di rilascio

Data: 2026-07-29

## Architettura

L'avvio è isolato in `apps/web/src/startup`: macchina a stati, discovery non
distruttiva, selezione fail-safe, retry limitato, schermata di avanzamento,
recupero guidato e diagnostica sicura. La UI non decide il backend e non cancella
archivi, preferenze o backup.

## Matrice decisionale

| Situazione | Decisione |
| --- | --- |
| Un solo archivio presente | Aprirlo e verificarlo |
| Due archivi presenti | Recupero guidato |
| Archivio bloccato o corrotto | Recupero guidato |
| Nessun archivio, OPFS disponibile | Preferenza OPFS |
| Nessun archivio, OPFS indisponibile | IndexedDB persistente |

## Verifiche

- Unit: orchestratore, discovery, selezione/retry, diagnostica e schermate di avvio.
- E2E: persistenza OPFS/IndexedDB, PWA offline, backup/restore e viewport 320/375/768/1024/1440.
- Accessibilità: ruoli `status` e `alert`, azioni tastiera native, reduced motion e layout responsive.
- Sicurezza: nessun reset o delete automatico; la diagnostica esclude dati finanziari e segreti.

## PWA

L'origine di sviluppo ufficiale è `http://127.0.0.1:5173`; preview usa la porta
4173. COOP/COEP, precache di WASM/worker, cleanup cache e auto-update del service
worker sono configurati nella PWA.

## Rischi residui

- Il browser non offre una API universale per enumerare ogni archivio IndexedDB:
  quando non è disponibile, lo stato resta prudenzialmente `unavailable`.
- I flussi di migrazione/unificazione tra due archivi rimangono guidati: Nexora non
  li automatizza per evitare sostituzioni di dati.
