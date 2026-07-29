# Baseline di avvio e storage

Data: 2026-07-30

## Ambiente

- Branch: `main`
- Node.js: 24.15.0
- pnpm: 11.9.0
- Runtime SQLite OPFS: richiede Worker, SharedArrayBuffer, COOP/COEP
  (`crossOriginIsolated`), WebAssembly e `navigator.storage.getDirectory`.

## Difetto riprodotto

La discovery considerava OPFS disponibile in base alla sola API `getDirectory`.
Il test `StorageDiscovery` riproduceva il caso con runtime SQLite OPFS non isolato:
la discovery restituiva un archivio OPFS utilizzabile/bloccato invece di
`unavailable`, inducendo la selezione di OPFS e una schermata di recovery pur con
IndexedDB utilizzabile.

## Correzione verificata

Discovery e apertura usano ora la stessa predicate
`isOpfsSqliteSupported`. Quando il runtime OPFS non soddisfa i requisiti, la
discovery non tenta né crea file OPFS e lo marca `unavailable`; la policy può quindi
scegliere IndexedDB per un’installazione nuova.

La preferenza del backend viene inoltre salvata solo dopo che l'orchestratore ha
concluso tutte le verifiche con stato `READY`, non durante l'apertura preliminare.
Un valore locale non riconosciuto viene rimosso in modo controllato e resta quindi
una semplice preferenza non autorevole, mai una causa di blocco dell'avvio.

## Stato di avvio deterministico

Il bootstrap ora propaga alla schermata di avvio la fase effettiva emessa
dall'orchestratore. Discovery, apertura, validazione, migrazione e verifica hanno
timeout espliciti; una risorsa già aperta viene chiusa se una fase successiva
fallisce. Invocazioni concorrenti riusano lo stesso tentativo, evitando aperture
duplicate durante il rendering React in sviluppo.

Quando due archivi con dati sono presenti, Nexora non ne apre uno in modo implicito:
la schermata di recupero consente di scegliere esplicitamente solo uno degli archivi
effettivamente rilevati. La scelta è monouso e viene rimossa prima dell'apertura.

Il recovery può inoltre validare un backup cifrato scelto dall'utente senza aprire
il ledger principale e senza modificare alcun archivio locale.

## Verifiche mirate

- `StorageDiscovery.test.ts`, `StorageSelection.test.ts`,
  `openPwaLedger.test.ts`: 19 test superati.
- `StartupOrchestrator.test.ts`, `StartupBootstrap.test.ts`, `App.test.tsx`:
  17 test superati.
- Typecheck di `@nexora/web`: superato.

La verifica completa dei gate segue il completamento dei successivi step di
fallback e recovery, per evitare di ripeterla senza modifiche funzionali.
