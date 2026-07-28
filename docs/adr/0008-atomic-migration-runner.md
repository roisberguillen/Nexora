# ADR 0008: Runner di migrazioni atomico

## Stato

Accepted

## Contesto

La persistenza offline deve poter aggiornare lo schema senza lasciare il database in uno
stato intermedio. Le migrazioni distruttive richiedono inoltre un backup verificato
prima dell'esecuzione, ma il formato fisico del backup dipenderà dall'adapter SQLite/OPFS.

## Decisione

- Il catalogo delle migrazioni è ordinato, contiguo dalla versione 1 e usa nomi univoci.
- Ogni migrazione dichiara esplicitamente `requiresBackup`.
- Il runner è forward-only, legge `schema_migrations` ed è idempotente.
- Ogni migrazione viene eseguita in una propria transazione `BEGIN IMMEDIATE`; lo storico
  viene aggiornato nella stessa transazione.
- Un errore SQL o di registrazione provoca `ROLLBACK` e non registra la versione.
- Prima di una migrazione con `requiresBackup: true`, il runner richiede a un
  `MigrationBackupProvider` una ricevuta con identificativo, timestamp e checksum
  SHA-256.
- Provider assente, errore del provider o ricevuta non valida bloccano la migrazione
  prima dell'apertura della transazione.
- Il runner dipende da una porta asincrona `MigrationDatabase`, così potrà funzionare
  con il worker SQLite/OPFS senza importare API Node o browser.

## Conseguenze

- Una migrazione non può risultare applicata solo parzialmente.
- Il catalogo applicativo non può ignorare versioni database sconosciute o nomi
  alterati.
- Il provider è responsabile della creazione fisica del backup e della verifica reale
  del checksum; il runner valida la ricevuta e impone l'ordine backup→migrazione.
- I percorsi `down` restano disponibili per test e recovery controllato, ma non vengono
  eseguiti automaticamente all'avvio dell'applicazione.
