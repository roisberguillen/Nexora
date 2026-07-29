# Threat model — Nexora

## Beni protetti

- ledger locale, archivio SQLite/OPFS o IndexedDB e relativi backup;
- passphrase di backup e token OAuth Google Drive;
- integrità di importazioni, movimenti e migrazioni.

## Controlli adottati

- Gli importi restano in minor units `bigint`; non sono convertiti in `float`.
- Le migrazioni sono atomiche, additive quando possibile e i percorsi distruttivi richiedono un
  backup verificato.
- I backup fisici sono cifrati AES-256-GCM con chiave derivata dalla passphrase; checksum,
  integrità SQLite e foreign key sono verificati prima di dichiarare riusciti backup e restore.
- Google Drive riceve solo l’archivio già cifrato nel private `appDataFolder`; il token OAuth
  è mantenuto esclusivamente in memoria e viene revocato al disconnect.
- Il blocco opzionale dell’app conserva soltanto un verificatore PBKDF2 e termina la sessione UI
  per inattività; non sostituisce la protezione del profilo del sistema e non cifra il ledger.
- File importati ed esportati sono elaborati localmente; CSV neutralizza le formule.
- I trasferimenti non contribuiscono ai report income/expense; le scritture composte sono
  transazionali nei due adapter persistenti.

## Rischi residui e operatività

- Una passphrase dimenticata non è recuperabile: è una proprietà intenzionale della cifratura.
- Un browser o dispositivo compromesso può leggere dati già aperti nella sessione: usare un
  profilo utente protetto e bloccare il dispositivo.
- OAuth richiede un client ID configurato dal deployment; nessuna credenziale è inclusa nel
  repository.
- Prima di aggiornare l’app, mantenere almeno un backup verificato su supporto distinto.
