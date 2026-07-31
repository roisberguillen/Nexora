# Backup e ripristino

Formato bundle suggerito: archivio cifrato contenente database, attachments, settings e `manifest.json`.

Il manifest include: versione formato, versione schema, timestamp UTC, app version, file list, dimensioni e SHA-256.

Destinazioni:
- file manuale cifrato `.nexora`, scelto dall'utente;
- Google Drive tramite adapter OAuth;
- entrambe, con esito separato quando l'utente abilita Drive.

Un backup è “riuscito” solo dopo verifica checksum. Periodicamente Nexora deve eseguire un restore test su database temporaneo.

## Backup preventivo delle migrazioni

Ogni migrazione dichiara se può eliminare o trasformare dati. Prima di una migrazione
distruttiva il runner richiede una ricevuta verificata dal provider di backup con:

- identificativo non ambiguo;
- timestamp UTC;
- checksum SHA-256.

Se il provider non è disponibile, la creazione fallisce o la ricevuta non è valida, la
migrazione non viene avviata. Il runner garantisce l'ordine backup→migrazione; il
provider dell'adapter persistente è responsabile della copia fisica e della verifica
del checksum.

## Formato locale SQLite/OPFS v1

La Milestone 2 implementa il sottoinsieme fisico del database primario:

- estensione `.nexora-backup`;
- manifest e bytes SQLite entrambi cifrati;
- AES-256-GCM con salt e IV casuali per ogni archivio;
- PBKDF2-HMAC-SHA-256 con 600.000 iterazioni;
- SHA-256 del database nel manifest;
- SHA-256 dell'intero archivio cifrato nella ricevuta;
- limite 512 MiB.

Il provider considera riuscito il backup soltanto dopo aver riletto il file dalla
directory, confrontato il checksum, decifrato il contenuto e verificato il manifest.
La passphrase non viene salvata nell'archivio e non è recuperabile.

Il restore è sempre un'azione esplicita. Prima della sostituzione:

1. verifica autenticità AES-GCM, manifest, checksum e versione schema;
2. carica il database in memoria ed esegue `PRAGMA integrity_check`;
3. esporta una copia di rollback del database OPFS corrente;
4. importa il backup e ripete i controlli;
5. in caso di errore tenta di ripristinare automaticamente la copia precedente.

Il flusso UI per scegliere directory, passphrase e confermare la sostituzione appartiene
alla successiva integrazione PWA. Configurazione, allegati, IndexedDB, cronologia e Google Drive
restano nel perimetro della Milestone 8.
