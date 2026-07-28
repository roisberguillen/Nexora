# Nexora Web PWA

App React/Vite installabile e offline-first. La shell apre all'avvio il repository
SQLite/OPFS oppure IndexedDB, registra il backend soltanto dopo una prima apertura
riuscita e forza la stessa scelta nelle sessioni successive. Loading, archivio pronto
ed errore sono stati espliciti; nessun errore OPFS viene mascherato con un archivio
alternativo.

Il service worker include shell, font, worker e runtime SQLite WASM. Il dataset
dimostrativo è interamente sintetico e viene salvato solo dopo un'azione esplicita su
un ledger vuoto.

La prima slice della Milestone 3 aggiunge una dashboard di sola lettura con patrimonio
EUR, entrate, spese, saldo dei flussi, conti e attività recenti. La proiezione usa i
servizi contabili del dominio: trasferimenti e annullamenti non vengono riclassificati
dalla UI. Valute diverse restano visibili nei conti ma non vengono convertite
implicitamente.

La seconda slice della Milestone 3 aggiunge la pagina Conti e i relativi comandi
applicativi. Creazione, modifica, archiviazione e riattivazione vengono salvate nel
backend già selezionato. L'input del saldo iniziale viene convertito direttamente in
minor units `bigint`; dopo il primo movimento il saldo iniziale è bloccato e la UI
indica che una correzione dovrà usare una rettifica.

## Comandi

- `pnpm dev`: server di sviluppo;
- `pnpm build`: build di produzione con service worker;
- `pnpm preview`: anteprima locale della build.
