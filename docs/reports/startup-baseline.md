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

## Verifiche mirate

- `StorageDiscovery.test.ts`, `StorageSelection.test.ts`,
  `openPwaLedger.test.ts`: 18 test superati.
- Typecheck di `@nexora/web`: superato.

La verifica completa dei gate segue il completamento dei successivi step di
fallback e recovery, per evitare di ripeterla senza modifiche funzionali.
