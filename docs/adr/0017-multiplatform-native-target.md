# ADR 0017: destinazione multipiattaforma nativa

## Stato

Accepted

## Decisione

Nexora usa React, TypeScript e Vite per le feature condivise; Tauri 2 è la destinazione per
Windows, macOS e Android. Le app native usano SQLite nativo, mentre PWA browser conserva SQLite
WASM/OPFS e IndexedDB dietro contratti equivalenti.

## Conseguenze

Le feature non dipendono da un adapter concreto. Ogni piattaforma possiede il proprio ledger e
la condivisione avviene solo tramite operation log e pairing, mai copiando un database aperto.
