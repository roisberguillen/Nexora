# ADR 0017: destinazione multipiattaforma nativa

## Stato

Accepted

## Decisione

Nexora usa React, TypeScript e Vite per le feature condivise; Tauri 2 è la destinazione per
Windows, macOS e Android. Le app native usano SQLite nativo, mentre PWA browser conserva SQLite
WASM/OPFS e IndexedDB dietro contratti equivalenti.

L'adapter `@nexora/database-tauri` usa il plugin SQL ufficiale di Tauri e implementa la porta
asincrona `SqliteDatabase`. Il bootstrap nativo apre soltanto un URL SQLite relativo e di proprietà
dell'app (`sqlite:nexora.db`), quindi applica lo stesso `MigrationRunner`, lo stesso catalogo di
migrazioni e lo stesso `SqliteLedgerRepository` della PWA. La preferenza browser
`nexora.ledger-storage.v1` non viene letta né scritta dal runtime Tauri.

## Conseguenze

Le feature non dipendono da un adapter concreto. Ogni piattaforma possiede il proprio ledger e
la condivisione avviene solo tramite operation log e pairing, mai copiando un database aperto.
Una modifica futura dello schema deve quindi aggiungere una sola migrazione condivisa e provarla
sia con l'adapter browser sia con quello nativo.
