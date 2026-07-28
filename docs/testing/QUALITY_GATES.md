# Quality Gates

## Comandi locali

- `pnpm format:check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm test`;
- `pnpm build`;
- `pnpm test:e2e`;
- `pnpm manifest:check`.

`pnpm verify` esegue tutti i gate veloci fino alla build. Gli E2E vengono mantenuti
separati perché richiedono Chromium.

## Per ogni PR
- format/lint/typecheck verdi;
- unit test e integration test verdi;
- nessun segreto o dato finanziario reale;
- copertura delle regole modificate;
- aggiornamento documentazione pertinente.

## Importatori
- fixture valida, sporca, duplicata e parzialmente corrotta;
- dry-run deterministico;
- re-import idempotente;
- undo batch verificato;
- totale righe spiegato al 100%;
- trasferimenti esclusi dai report di spesa.

## Persistenza
- migrazione forward e rollback o restore documentato;
- test di crash durante commit;
- integrità referenziale;
- backup prima di migrazione distruttiva.
- riapertura reale SQLite/OPFS in Chromium con verifica degli importi esatti;
- riapertura reale IndexedDB in Chromium con verifica degli importi esatti;
- rollback atomico delle gambe di trasferimento su SQLite e IndexedDB;
- nessun fallback IndexedDB per errori OPFS diversi da `opfs_unavailable`;
- backend PWA registrato solo dopo un'apertura riuscita e forzato nelle riaperture;
- seed dimostrativo idempotente, privo di dati personali e rifiutato sui ledger reali;
- backup fisico cifrato riletto e verificato prima della ricevuta di migrazione;
- restore OPFS reale con checksum, controllo schema, integrità e conservazione dei dati
  dopo un tentativo non valido;
- errore esplicito quando OPFS o l'isolamento cross-origin non sono disponibili.
- riapertura PWA con dati persistiti e rete indisponibile sia su OPFS sia su IndexedDB;

## UI
- tastiera completa sui flussi principali;
- contrasto e label;
- viewport 320, 768, 1440;
- offline mode;
- error/empty/loading states.
- importi formattati da minor units senza conversioni floating point;
- trasferimenti visualizzati senza alterare entrate o spese;
- tabella movimenti leggibile senza overflow anche su mobile.
- creazione, modifica, archiviazione e riattivazione conti verificate sui backend
  persistenti;
- saldo iniziale convertito da input localizzato direttamente in `bigint`, senza
  passaggio floating point;
- saldo iniziale bloccato dopo il primo movimento e gerarchie dei sottoconti protette;
- pagina conti accessibile e senza overflow a 320, 768 e 1440 px.

## Release
- performance con 100.000 transazioni;
- restore di backup verificato su database temporaneo e OPFS reale;
- audit vulnerabilità dipendenze;
- manuale utente aggiornato.
