# Specifica backup

## Destinazioni ammesse

1. File manuale cifrato `.nexora`, esportabile e trasferibile dall'utente.
2. Google Drive, come destinazione opzionale del medesimo Backup Engine.

NAS, SMB, cartelle di rete, share WD My Cloud, Docker backup agent e server separati di backup
non sono supportati. Nexora Local Hub serve esclusivamente alla sincronizzazione e non conserva
copie di backup.

## Contratto del bundle

Il Backup Engine produce snapshot SQLite coerente, manifest con versione app/schema/device e
conteggio record, checksum, cifratura e cronologia locale. Un backup è verificato solo dopo
decifratura, apertura temporanea del database, controllo tabelle/vincoli/migrazioni e checksum.
Il restore effettua sempre un backup preventivo e sostituisce i dati in modo transazionale.

## Engine portabile condiviso

La Fase 9 introduce `PortableBackupEngine` nel package database condiviso. L'engine riceve una
porta repository capace di sostituire atomicamente uno snapshot e non conosce file system,
download, OAuth o Google Drive. OPFS, IndexedDB e SQLite nativo usano lo stesso flusso:

1. cattura e codifica canonica del ledger;
2. cifratura tramite l'envelope approvato e autoverifica immediata;
3. verifica read-only di checksum, manifest, payload e compatibilità schema;
4. checkpoint portabile del ledger attivo prima del restore;
5. sostituzione atomica, rilettura completa e confronto canonico;
6. rollback e verifica del checkpoint in caso di errore.

Gli adapter di destinazione ricevono soltanto archivi già verificati. La Fase 9 non modifica i
primitivi AES-GCM/PBKDF2 né introduce destinazioni; file manuale e Drive restano rispettivamente
nelle Fasi 10 e 11.

## Flusso file manuale

La Fase 10 collega il Backup Engine al download e al restore esplicito della PWA:

1. il download viene offerto solo dopo l'autoverifica dell'archivio cifrato;
2. la passphrase non viene persistita e viene cancellata dopo la creazione riuscita;
3. un file selezionato viene verificato in sola lettura prima di abilitare il restore;
4. la ricevuta UI espone solo nome file, schema, data e prefisso checksum;
5. qualsiasi cambio di file o passphrase invalida la ricevuta;
6. un dialogo separato richiede conferma esplicita prima della sostituzione;
7. l'engine crea il checkpoint, verifica il risultato e applica rollback in caso di errore.

La cronologia locale conserva esclusivamente metadati tecnici dell'operazione. Google Drive non
fa parte della Fase 10 e riusa lo stesso archivio cifrato soltanto nella Fase 11.

## Flusso Google Drive

La Fase 11 usa Google Identity Services e lo scope minimo `drive.appdata`. L'account viene scelto
nel consenso Google e la destinazione è la cartella privata Nexora `appDataFolder`; non sono
supportate cartelle Drive arbitrarie. Il token resta soltanto in memoria.

Il provider riceve esclusivamente un archivio già cifrato e autoverificato. Lista, upload e download
validano identificatore, estensione, formato, schema, data, checksum e dimensione; archivi oltre
512 MiB sono rifiutati. Prima del restore, dimensione e checksum remoti devono coincidere con la
ricevuta e l'engine deve completare la verifica read-only. La sostituzione richiede quindi un dialogo
esplicito e mantiene checkpoint, verifica post-write e rollback dell'engine.

Gli upload non vengono ritentati automaticamente. La cancellazione remota è esclusa dai flussi
ordinari ed è ammessa soltanto dalla scelta esplicita già prevista nel ripristino totale.
