# ADR 0020: Pixel 9 come host temporaneo del Local Hub

## Stato

Accepted for roadmap PMA-0; implementation gated by PMA-1.

## Contesto

Il PC Manager PM-0–PM-8 già completato usa il PC come host del Local Hub e il Pixel come
controller di pairing. Il flusso desiderato per l'integrazione mobile è invece: avviare il Local
Hub dal Pixel e usare il PC per vedere la Desktop App Shell con i dati presenti sul telefono.

## Decisione

Il Pixel 9 può avviare esplicitamente un Local Hub Android temporaneo che espone, tramite HTTPS LAN,
soltanto API autorizzate di health, pairing, sessione e operation-log. Il PC è un client peer
autorizzato e non riceve il file SQLite del telefono. Il runtime deve terminare su stop esplicito,
logout/revoca, timeout o recovery da crash; il binding LAN è spento per default.

Il ledger del PC resta locale e offline-capable. La convergenza usa operation log incrementale,
cursor, idempotency key, tombstone e conflitti espliciti secondo ADR 0016 e `docs/SYNC_SPEC.md`.
Nessun trasferimento interno viene classificato come entrata o spesa.

## Confini e sicurezza

- Il telefono è host e pairing authority durante la sessione; il PC è client.
- La stessa rete è solo un prerequisito di trasporto, non una prova di fiducia.
- TLS/fingerprint, grant monouso, device binding, session token, rate limit e revoca sono obbligatori.
- Il passcode protegge la sessione, non sostituisce il pairing.
- Chiavi e credenziali usano primitive Android secure storage/Keystore già approvate.
- QR, log, URL e fixture non contengono segreti o dati finanziari.

## Conseguenze

- Sono necessari lifecycle e permessi Android specifici, da verificare prima dell'implementazione.
- La sincronizzazione diventa bidirezionale tra due ledger peer; non è un backup e non sostituisce
  il restore `.nexora` o Google Drive.
- Il precedente flusso PC-host resta supportato e non viene dichiarato modificato finché PMA-8 non
  è completo.
- Se Android non consente un listener affidabile in background senza permessi eccessivi, il flusso
  deve richiedere Nexora in foreground oppure fermarsi in modo esplicito e recuperabile.

## Gate

PMA-1 deve dimostrare compile Android, lifecycle, permessi minimali, loopback default, LAN
fail-closed e shutdown deterministico prima di collegare il ledger o il pairing reale.
