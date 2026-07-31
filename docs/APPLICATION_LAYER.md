# Layer applicativo condiviso

Il package `@nexora/application` contiene orchestrazione e read model indipendenti da React,
browser, OPFS, IndexedDB, Tauri e SQLite nativo. Dipende solo da `@nexora/domain`.

## Primo contratto

`readLedgerSnapshot(repository)` usa la porta `LedgerRepository` per caricare tutte le entità
necessarie alla UI in parallelo. Restituisce un `LedgerSnapshot` immutabile e non conosce il tipo
di database. Le proiezioni specifiche della UI (dashboard, conti e movimenti) restano per ora in
`apps/web`, ma ricevono il medesimo snapshot anche quando il runtime nativo sarà introdotto.

## Regole di dipendenza

```text
React / Tauri UI → @nexora/application → @nexora/domain → LedgerRepository
browser / SQLite nativo adapters ────────────────────────────────┘
```

Il layer non deve importare React, DOM, `window`, OPFS, IndexedDB, Tauri o SDK cloud. I comandi
con effetti collaterali seguiranno lo stesso schema: input validato, repository port e risultato
serializzabile. Questo vincolo permette alla Fase 7 di aggiungere SQLite nativo senza duplicare
regole contabili o query applicative.
