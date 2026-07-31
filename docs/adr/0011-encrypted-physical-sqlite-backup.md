# ADR 0011: backup fisico SQLite cifrato e restore verificato

## Stato

Accepted

## Contesto

Le migrazioni distruttive richiedono un backup fisico verificato prima di modificare
lo schema. La Milestone 2 richiede inoltre un ripristino locale basilare. Un semplice
export JSON non conserva fedelmente il database SQLite e un file SQLite in chiaro
esporrebbe dati finanziari a chiunque possa leggere la destinazione.

## Decisione

- Esportare il database aperto nel worker tramite l'API ufficiale
  `sqlite3_js_db_export`.
- Usare un archivio binario Nexora con:
  - magic e versione formato;
  - parametri KDF autenticati;
  - manifest JSON;
  - bytes fisici `database.sqlite3`.
- Cifrare manifest e database con AES-256-GCM.
- Derivare la chiave dalla passphrase tramite PBKDF2-HMAC-SHA-256, salt casuale da
  128 bit e 600.000 iterazioni. Ogni archivio usa anche un IV casuale da 96 bit.
- Includere nel manifest versione schema, timestamp UTC, versione applicazione,
  dimensione e SHA-256 del database.
- Calcolare un secondo SHA-256 sull'intero archivio cifrato. Il provider scrive il
  file, lo rilegge, confronta il checksum e lo decifra prima di emettere la ricevuta
  `VerifiedMigrationBackup`.
- Limitare database e restore a 512 MiB in questa prima versione per evitare
  allocazioni non controllate nel browser.
- Usare file `.nexora-backup` portabili, cifrati e scaricati esplicitamente dall'utente. La
  destinazione resta sotto il suo controllo senza introdurre selezione directory, NAS o SMB.
- Prima del restore:
  - autenticare e decifrare l'archivio;
  - verificare manifest, checksum e compatibilità schema;
  - deserializzare i bytes in un database temporaneo nel worker;
  - eseguire `PRAGMA integrity_check`;
  - verificare che la versione schema fisica coincida con il manifest.
- Prima di sostituire OPFS, esportare in memoria il database corrente. Se importazione
  o verifica post-restore falliscono, tentare automaticamente il rollback di quei
  bytes.
- Non supportare WAL nei backup importati; Nexora continua a usare il journal di
  rollback definito dall'ADR 0009.

## Conseguenze

- Il backup preventivo delle migrazioni è fisico e realmente verificato.
- Una passphrase dimenticata non può essere recuperata da Nexora.
- Creazione e restore richiedono memoria proporzionale alla dimensione del database.
- Il provider copre il backend primario SQLite/OPFS. Backup logico del fallback
  IndexedDB, configurazione, allegati, cronologia e Google Drive restano nella Milestone 8.
- Il restore non viene eseguito automaticamente e dovrà richiedere conferma esplicita
  nell'interfaccia PWA.
