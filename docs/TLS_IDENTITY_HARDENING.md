# Local Hub TLS identity hardening

Il Local Hub Android conserva il certificato e i metadati pubblici in
`phone-local-hub-identity.json`. La private key TLS resta nel keystore nativo
con alias `nexora.local-hub.tls.v1` e non viene serializzata nel JSON, negli
inviti pairing o nei log.

All'avvio LAN l'identità persistita passa questi controlli, prima dell'apertura
del listener:

- il certificato PEM è parseabile e temporalmente valido;
- il fingerprint `sha256:<64 hex>` coincide con l'hash SHA-256 del certificato
  DER reale;
- Rustls verifica crittograficamente che la private key del keystore corrisponda
  alla chiave pubblica del certificato;
- `host_identity` è presente in un SAN DNS del certificato;
- il certificato contiene un algoritmo supportato dal provider Rustls.

Ogni errore è fail-closed. JSON corrotto, alias errato, key mancante,
certificato alterato, fingerprint alterato, mismatch cert/key, SAN incoerente,
certificato senza SAN o certificato non valido producono un errore diagnostico e
non generano una nuova identità. Il reset dell'identità resta una procedura
manuale di recovery che richiede un nuovo pairing esplicito.

La richiesta nativa PC accetta solo HTTPS, l'origine dell'endpoint paired, un
hostname uguale a `host_identity`, un indirizzo privato della LAN, certificato e
fingerprint pinned. Disabilita i redirect, rifiuta userinfo, URL HTTP, host
arbitrari, loopback non paired, indirizzi esterni, fingerprint mancanti o errati
e path traversal. Il pinning usa il certificato presentato come unica CA e
verifica anche il fingerprint DER e il SAN prima della richiesta.

Il cambio IP non cambia l'identità: `host_identity`, certificato, private key e
fingerprint restano stabili; il nuovo endpoint LAN viene risolto solo dopo un
nuovo health/discovery paired. La rilevazione dell'indirizzo locale usa le
interfacce locali e non contatta host Internet.

Copertura automatica: validazione Rust del certificato/keypair/SAN/fingerprint,
test di tampering e metadata mancanti, test Tauri di host confusion e trasporto
insicuro, parser pairing HTTPS e test di origine paired nel client web.
