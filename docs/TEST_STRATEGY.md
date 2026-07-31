# Strategia di test UI, piattaforme e dati

Ogni vertical slice copre dominio, repository, command/query, UI desktop/mobile e flusso E2E.
I viewport minimi sono 320, 390, 768 e 1440 px; sono obbligatori tastiera, screen reader,
loading, empty, errore, offline e recovery.

Gli adapter browser e nativi condividono gli stessi contratti e ricevono test di migrazione,
rollback atomico, integrità e dataset da 100.000 e 500.000 movimenti. Backup richiede verifica
di decifratura e database temporaneo; sync richiede pairing, revoca, idempotenza, conflitti e
interruzioni di rete. Prima di ogni release: `pnpm verify`, `pnpm test:e2e`,
`pnpm manifest:check`, audit dipendenze e smoke test della piattaforma interessata.
