# ADR 0002: Offline-first persistence

## Stato
Accepted

## Decisione
Usare SQLite WASM su OPFS quando disponibile e un adapter fallback IndexedDB. Il dominio dipende solo da repository interface.
