# Threat Model sintetico

## Asset
Database finanziario, allegati, backup, token cloud, configurazioni e audit log.

## Minacce principali
- accesso locale non autorizzato;
- perdita o corruzione database;
- backup leggibile da terzi;
- dipendenze malevole;
- file importati maleformati;
- formula injection negli export CSV/XLSX;
- esposizione dati nei log.

## Contromisure
- blocco app opzionale con verificatore PBKDF2 e timeout di inattività; il blocco protegge la
  sessione, ma non cifra il ledger conservato dal browser;
- backup AES-GCM cifrati prima della scrittura;
- manifest autenticato, checksum SHA-256 e versionamento;
- validazione del restore in database temporaneo e rollback preventivo;
- parser in ambiente limitato con limiti dimensione/righe;
- sanitizzazione celle esportate che iniziano con `=`, `+`, `-`, `@`;
- dependency pinning e audit;
- logging strutturato con redazione;
- CSP e nessun segreto nel frontend.
