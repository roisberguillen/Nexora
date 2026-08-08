# ADR 0009: SQLite WASM su OPFS in worker dedicato

## Stato

Accepted

## Contesto

SQLite su OPFS richiede l'esecuzione in un Web Worker e un contesto cross-origin
isolated. Le API SQLite Worker1/Promiser sono deprecate e non sono adatte come base
estensibile dell'applicazione. Il dominio deve inoltre restare indipendente da WASM,
browser e dettagli del protocollo del worker.

## Decisione

- Usare il pacchetto ufficiale `@sqlite.org/sqlite-wasm`, bloccato nel lockfile.
- Inizializzare l'API OO1 direttamente in un worker applicativo dedicato.
- Aprire il database con `OpfsDb` e un percorso assoluto confinato in OPFS.
- Configurare development e preview con:
  - `Cross-Origin-Opener-Policy: same-origin` sulla shell che apre il ledger;
  - `Cross-Origin-Embedder-Policy: require-corp`.
- Servire esclusivamente il ponte OAuth Google su una route separata con
  `Cross-Origin-Opener-Policy: same-origin-allow-popups`; la route non monta React, SQLite,
  repository o dati finanziari.
- Usare una porta asincrona `SqliteDatabase` tra repository, migrazioni e runtime.
- Serializzare tutte le operazioni del repository sulla singola connessione; ogni
  scrittura usa `BEGIN IMMEDIATE`.
- Usare il journal di rollback predefinito e un busy timeout. WAL non viene abilitato
  finché non saranno definite e testate le regole di locking OPFS.
- Se OPFS, SharedArrayBuffer o l'isolamento cross-origin non sono disponibili, restituire
  `opfs_unavailable`. Non usare silenziosamente memoria volatile.
- Mantenere IndexedDB come adapter fallback separato della Milestone 2.

## Conseguenze

- SQLite e il filesystem rimangono fuori dal thread UI.
- Migrazioni e repository condividono lo stesso contratto e possono essere testati anche
  contro SQLite nativo.
- La PWA deve essere servita con gli header di isolamento anche in produzione.
- Risorse remote future dovranno essere compatibili con COEP oppure incluse localmente.
- Browser senza i requisiti OPFS richiederanno il fallback IndexedDB prima che i flussi
  di modifica dati possano essere abilitati.
