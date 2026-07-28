# ADR 0010: fallback IndexedDB e selezione fail-safe

## Stato

Accepted

## Contesto

SQLite su OPFS richiede Web Worker, `SharedArrayBuffer` e isolamento cross-origin.
Alcuni browser o contesti di esecuzione non offrono questi requisiti, ma la PWA deve
restare utilizzabile offline senza degradare verso memoria volatile. Un fallback
automatico indiscriminato, però, potrebbe nascondere un errore di un database OPFS già
esistente aprendo un archivio IndexedDB distinto e apparentemente vuoto.

## Decisione

- Implementare il fallback con l'API IndexedDB nativa, senza dipendenze runtime.
- Usare uno schema v1 con object store `metadata`, `accounts`, `categories`,
  `transactions` e `transfers`; gli identificatori di dominio sono le chiavi primarie.
- Indicizzare le transazioni per conto e categoria.
- Condividere con SQLite i codec dei record persistenti. Gli importi in minor units
  restano stringhe decimali canoniche e vengono ricostruiti come `bigint`.
- Creare lo schema iniziale nella transazione atomica `versionchange` di IndexedDB.
- Eseguire ogni scrittura del repository in una singola transazione `readwrite`; un
  trasferimento e le sue due o tre gambe usano la stessa transazione.
- Serializzare le operazioni per connessione e chiudere la connessione quando arriva
  `versionchange`, così un'altra scheda può completare un aggiornamento.
- Preferire OPFS quando i prerequisiti sono presenti. Usare IndexedDB soltanto quando
  tali prerequisiti mancano o il worker restituisce esplicitamente
  `opfs_unavailable`.
- Non attivare il fallback per errori del worker, record corrotti, upgrade bloccati o
  altre anomalie del database OPFS.
- Usare `fake-indexeddb` esclusivamente nei test Node e mantenere uno smoke test sul
  motore IndexedDB reale di Chromium.

## Conseguenze

- Browser senza OPFS dispongono di persistenza locale durevole e offline.
- Un guasto del ledger OPFS rimane visibile e non viene mascherato da un secondo
  archivio.
- I due backend rispettano lo stesso contratto di repository e lo stesso formato
  logico dei valori finanziari.
- Non esiste ancora una migrazione automatica tra IndexedDB e OPFS. L'integrazione PWA
  dovrà mantenere stabile il backend scelto per un profilo fino a un flusso esplicito
  di esportazione, verifica e importazione.
- Le future modifiche distruttive allo schema IndexedDB richiederanno backup verificato
  e percorso di recovery prima di aumentare la versione.
