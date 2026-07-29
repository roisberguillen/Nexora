# Audit baseline — avvio e persistenza

Data: 2026-07-29
Branch: `main`
Commit di partenza: `971272a docs(release): registra verifica finale su main`

## Implementazione osservata

Il bootstrap della PWA apre il ledger prima del render dell'applicazione. La scelta
persistita in `localStorage` viene oggi considerata vincolante: OPFS viene preferito
quando disponibile e IndexedDB è il fallback persistente. Le anomalie non
`opfs_unavailable` non ricevono fallback automatico. La connessione viene chiusa su
`pagehide`.

Sono presenti header COOP/COEP in Vite per sviluppo e preview, precache del runtime
WASM e dei worker, e test Playwright per persistenza OPFS/IndexedDB e riapertura
offline. Il bootstrap non dispone ancora di discovery indipendente, classificazione
utente degli errori o recupero guidato tra due archivi potenzialmente contenenti dati.

## Scenari da coprire nella nuova orchestrazione

| Scenario | Stato baseline | Comportamento osservato/atteso |
| --- | --- | --- |
| Primo avvio con OPFS | coperto da adapter e PWA | sceglie OPFS quando i prerequisiti sono presenti |
| Primo avvio senza OPFS | coperto da adapter | usa IndexedDB persistente |
| Preferenza OPFS non disponibile | coperto unitariamente | errore visibile, senza fallback silenzioso |
| Preferenza IndexedDB | coperto da PWA | apre IndexedDB e conserva la scelta |
| OPFS con dati e IndexedDB vuoto | non distinguibile in bootstrap | deve selezionare OPFS dopo discovery |
| IndexedDB con dati e OPFS vuoto | non distinguibile in bootstrap | deve selezionare IndexedDB dopo discovery |
| Entrambi con dati | non coperto | richiede recupero guidato, mai scelta silenziosa |
| Entrambi vuoti | parzialmente coperto | deve scegliere un backend predefinito sicuro |
| Errore temporaneo / database bloccato | non classificato | richiede retry limitato e diagnostica sicura |
| Errore migrazione | coperto dal runner | deve rimanere bloccante senza modifiche automatiche |
| Runtime WASM assente | non coperto end-to-end | deve restare recuperabile senza creare archivi sostitutivi |

## Quality gate eseguito

Tutti i comandi hanno restituito codice zero:

- `pnpm doctor` — Node 24.15.0 e pnpm 11.9.0; OPFS/File System Access da verificare nel browser, Google Drive non configurato.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` — verdi.
- `pnpm test` — 69 file passati, 257 test passati, 4 skip espliciti.
- `pnpm build` e `pnpm manifest:check` — verdi.
- `pnpm test:e2e` — 116 passati, 34 skip espliciti su 5 viewport (320, 375, 768, 1024, 1440 px).
- `pnpm audit --prod` — nessuna vulnerabilità nota.

## Rischi iniziali

- La preferenza è l'unico indizio persistito per la scelta del backend e può essere
  assente, non valida o non più compatibile con il contesto browser.
- I due archivi non vengono ancora inventariati prima dell'apertura, quindi non esiste
  una scelta esplicita per il caso in cui entrambi abbiano dati.
- Il messaggio di avvio espone dettagli tecnici e non presenta fasi reali o opzioni di
  recovery.

La roadmap Startup Orchestrator affronta questi rischi senza eliminare né resettare
automaticamente archivi, preferenze o backup.
