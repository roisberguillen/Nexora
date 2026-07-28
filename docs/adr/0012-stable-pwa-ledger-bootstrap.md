# ADR 0012: bootstrap PWA e selezione stabile del ledger

## Stato

Accepted

## Contesto

La PWA deve aprire il repository persistente all'avvio e continuare a usare lo stesso
backend nelle sessioni successive. Ripetere a ogni caricamento la selezione automatica
OPFS→IndexedDB potrebbe mostrare un archivio diverso se cambiano isolamento
cross-origin, API disponibili o condizioni del worker. React Strict Mode non deve
inoltre creare due connessioni concorrenti durante il bootstrap.

## Decisione

- Estendere `openBrowserLedger` con `preferredStorageKind`:
  - `opfs` forza SQLite/OPFS e non permette fallback;
  - `indexeddb` apre direttamente IndexedDB;
  - l'assenza della preferenza mantiene la selezione fail-safe dell'ADR 0010.
- Registrare in `localStorage` soltanto il tipo di backend, senza dati finanziari, e
  solo dopo la prima apertura completata.
- Trattare preferenza illeggibile, valore non valido e mancata persistenza come errori
  espliciti. Se il salvataggio fallisce, chiudere il ledger appena aperto.
- Creare una sola promise di apertura nel bootstrap della pagina, condividerla con
  React e chiudere la connessione su `pagehide`.
- Mostrare stati distinti di apertura, archivio pronto ed errore. Un errore non apre un
  archivio alternativo.
- Non applicare automaticamente il seed. L'inserimento del dataset sintetico richiede
  un'azione esplicita ed è disponibile soltanto su un ledger vuoto.
- Includere il runtime SQLite WASM nel precache della PWA e verificare con rete
  realmente indisponibile la riapertura sia di OPFS sia di IndexedDB.

## Conseguenze

- Il backend resta stabile finché i dati del sito, inclusa la preferenza, vengono
  conservati dal browser.
- La perdita selettiva della preferenza causata da strumenti esterni riattiva il
  percorso di prima selezione; la futura gestione dei profili potrà introdurre un
  registro ridondante e un flusso di recovery.
- L'app può comunicare backend, versione schema e conteggi senza esporre record
  finanziari nei log.
- Worker, proxy OPFS, WebAssembly, font e shell sono disponibili tramite il service
  worker dopo almeno un caricamento online completato.
