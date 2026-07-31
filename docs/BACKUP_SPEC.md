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
