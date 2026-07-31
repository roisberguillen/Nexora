# Database

Repository adapter, migrazioni, transazioni e backup locale.

La Milestone 1 include `InMemoryLedgerRepository`, usato per testare riferimenti,
duplicati e commit logico atomico dei trasferimenti.

La prima fase della Milestone 2 introduce lo schema SQLite v1 come migrazione
reversibile. Lo schema contiene conti, categorie, transazioni, trasferimenti e storico
della versione. Gli importi sono memorizzati come stringhe decimali canoniche per
preservare tutti i valori `bigint`; i vincoli SQLite verificano segni, date, valute,
riferimenti e coerenza dei bundle di trasferimento.

Ogni connessione deve applicare `requiredSqlitePragmas` prima di eseguire migrazioni o
query.

`MigrationRunner` applica il catalogo in ordine, registra ogni versione nella stessa
transazione dello schema e può essere eseguito più volte senza duplicare operazioni.
Le migrazioni dichiarate distruttive richiedono un `MigrationBackupProvider`: senza una
ricevuta verificata con checksum SHA-256 il runner si arresta prima della migrazione.

`SqliteLedgerRepository` implementa il contratto del dominio e serializza tutte le
operazioni sulla connessione. `openOpfsLedger` avvia un worker dedicato, apre il file
SQLite tramite OPFS, applica le migrazioni e restituisce repository e funzione di
chiusura. Importi e date vengono ricostruiti attraverso i value object del dominio.

I repository implementano anche `updateAccount`. L'operazione conserva tipo, valuta e
conto padre, blocca variazioni del saldo iniziale dopo il primo movimento e valida
l'archiviazione padre-sottoconto nella stessa transazione della scrittura.

`IndexedDbLedgerRepository` offre lo stesso contratto nei browser privi dei requisiti
OPFS. Lo schema v1 contiene metadata, conti, categorie, transazioni e trasferimenti;
le scritture sono atomiche e i trasferimenti vengono salvati insieme a tutte le gambe.
Il package `fake-indexeddb` è una dipendenza solo di sviluppo: la produzione usa
direttamente l'API del browser.

`openBrowserLedger` preferisce OPFS e usa IndexedDB soltanto se OPFS è realmente
indisponibile. Errori del worker o del database OPFS vengono propagati, evitando di
mostrare silenziosamente un archivio alternativo. `preferredStorageKind` permette alla
PWA di forzare nelle riaperture il backend registrato: OPFS indisponibile resta quindi
un errore visibile e non attiva IndexedDB.

`seedDemoLedger` crea un dataset esclusivamente sintetico con conti, categorie,
transazioni, stato annullato e trasferimento interno. Usa identificatori deterministici,
è serializzato per repository e può completare un seed parziale compatibile. Non viene
mai applicato automaticamente: rifiuta ledger non vuoti e collisioni, mentre una nuova
esecuzione sul seed completo restituisce `already_present`.

`LocalSqliteBackupService` esporta il database SQLite fisico, costruisce un manifest
versionato con checksum SHA-256 e cifra l'intero archivio con AES-256-GCM derivando la
chiave dalla passphrase. `FileSystemDirectoryBackupStore` scrive l'archivio nella
directory scelta, lo rilegge e ne verifica il checksum prima di emettere una ricevuta
valida per `MigrationBackupProvider`.

Il ripristino autentica e verifica archivio, manifest, checksum e versione dello schema
prima di sostituire il database. Il worker convalida prima i byte in un database
temporaneo e conserva un'esportazione in memoria per il rollback. `openOpfsLedger`
accetta `backupProviderFactory` per collegare questo provider alle future migrazioni
distruttive solo dopo l'apertura della connessione fisica.

Il formato corrente copre SQLite/OPFS fino a 512 MiB. Backup completi del fallback
IndexedDB, impostazioni, allegati e Google Drive restano nella Milestone 8.
