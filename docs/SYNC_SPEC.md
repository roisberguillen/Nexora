# Specifica Nexora Local Hub e sincronizzazione

Il Local Hub è un servizio Rust incorporato, disattivato per default. Ascolta su loopback finché
l'utente non abilita esplicitamente la LAN; il binding LAN usa HTTPS, mDNS/DNS-SD, pairing QR
temporaneo e identità crittografiche per dispositivo.

Quando l'host è configurato per pubblicare una superficie browser locale, `/v1/health` può
annunciare un `appUrl` esplicito. La PWA mostra il collegamento soltanto dopo una verifica health
riuscita e lo apre in una nuova scheda senza persistere credenziali. L'URL non abilita né sostituisce
il pairing: l'accesso ai dati continua a richiedere origine autorizzata, fingerprint dell'host,
device id e token a scadenza. In assenza di `appUrl` la PWA resta solo locale.

La sincronizzazione usa operation log incrementale, cursori, idempotency key, tombstone e retry.
I conflitti su dati finanziari restano espliciti e non possono sovrascrivere silenziosamente
movimenti, split, trasferimenti o cancellazioni. Ogni dispositivo resta utilizzabile offline sul
proprio ledger; non viene mai copiato in rete un file SQLite aperto.
