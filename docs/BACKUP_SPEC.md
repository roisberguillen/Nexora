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
