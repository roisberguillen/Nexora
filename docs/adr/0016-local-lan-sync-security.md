# ADR 0016: host locale e pairing sicuro per sincronizzazione LAN

## Stato

Accepted

## Decisione

Il ledger condiviso sarà posseduto da un host locale esplicito, non dai database browser OPFS/IndexedDB. L'host ascolta esclusivamente su loopback per impostazione predefinita; l'esposizione LAN richiede consenso esplicito e un'origine autorizzata. Ogni client deve essere associato fuori banda al fingerprint dell'host e riceve una credenziale per dispositivo a durata limitata. Ogni richiesta controlla device id, token, fingerprint, origine e scadenza.

Le operazioni di sincronizzazione avranno idempotency key, cursor e log append-only. I conflitti non possono sovrascrivere silenziosamente i record finanziari: restano visibili fino a risoluzione utente. La PWA resta pienamente offline sul proprio ledger finché non viene configurata una migrazione esplicita verso l'host.

## Conseguenze

- Il server LAN non viene esposto accidentalmente su interfacce pubbliche.
- La semplice disponibilità di `localhost` non equivale a condivisione PC-smartphone: serve un host configurato e autorizzato.
- Il pairing e le credenziali saranno revocabili; nessun token viene scritto nei log o nel repository di codice.
