# Specifica Nexora Local Hub e sincronizzazione

Il Local Hub è un servizio Rust incorporato, disattivato per default. Ascolta su loopback finché
l'utente non abilita esplicitamente la LAN; il binding LAN usa HTTPS, mDNS/DNS-SD, pairing QR
temporaneo e identità crittografiche per dispositivo.

La sincronizzazione usa operation log incrementale, cursori, idempotency key, tombstone e retry.
I conflitti su dati finanziari restano espliciti e non possono sovrascrivere silenziosamente
movimenti, split, trasferimenti o cancellazioni. Ogni dispositivo resta utilizzabile offline sul
proprio ledger; non viene mai copiato in rete un file SQLite aperto.
