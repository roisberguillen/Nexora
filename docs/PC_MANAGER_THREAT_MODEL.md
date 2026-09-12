# PC Manager Nexora — threat model e contratto PM-0

## Scope

Questo documento congela il modello di fiducia del PC Manager prima dell'implementazione runtime.
Il percorso riguarda un Pixel 9 che autorizza un browser desktop a usare un Local Hub Nexora
sulla rete locale. Il Local Hub possiede il ledger host; il browser desktop è un client autorizzato.

## Ruoli e confini di fiducia

- **Telefono/controller:** mostra consenso, pairing, fingerprint, dispositivi autorizzati e revoca.
  Non trasferisce un file SQLite aperto.
- **Local Hub/host:** possiede il ledger e l'operation log, applica autorizzazione, rate limit,
  revoca, cursori, idempotenza e conflitti.
- **Browser desktop/client:** esegue la vera App Shell Nexora dopo pairing; conserva soltanto lo
  stato locale necessario al client e continua a operare offline secondo il contratto PWA.
- **Rete locale:** è un mezzo di trasporto non fidato. Essere sulla stessa Wi-Fi non equivale a
  essere autorizzati.
- **Attaccante di rete:** può osservare, riprodurre o modificare traffico, QR, richieste e
  discovery; non deve ottenere accesso al ledger senza superare TLS e pairing.

## Asset da proteggere

- dati finanziari, saldi, movimenti, conti, categorie e journal;
- chiavi/certificati TLS e fingerprint dell'host;
- grant QR, device id, token di sessione e credenziali per dispositivo;
- operation log, cursor, revisioni, tombstone e conflitti;
- audit metadata e stato di revoca;
- integrità della Desktop App Shell e degli aggiornamenti.

## Invarianti di autorizzazione

Ogni richiesta ledger/sync deve verificare tutti gli elementi seguenti:

1. origine autorizzata;
2. TLS e fingerprint dell'host atteso;
3. device id associato;
4. token valido, non scaduto e non revocato;
5. grant con scopo corretto;
6. rate limit del dispositivo;
7. schema/protocollo compatibile.

Un health check senza credenziali può descrivere lo stato tecnico minimo, ma non concede accesso
al ledger né sostituisce il pairing.

## Stati e transizioni

| Stato | Ingresso | Uscita valida | Dati esposti |
|---|---|---|---|
| `solo-locale` | default | avvio hub esplicito | nessun ledger remoto |
| `hub-in-avvio` | start richiesto | pronto o errore | health locale |
| `rete-non-idonea` | LAN assente/isolation/VPN incompatibile | rete verificata o annulla | motivo redatto |
| `in-attesa-pairing` | host LAN pronto | QR scaduto, annullato o richiesta browser | discovery e fingerprint |
| `pairing-richiesto` | browser presenta grant | conferma o rifiuto telefono | metadati browser non finanziari |
| `pairing-confermato` | consenso telefono | sessione attiva o timeout | credenziale volatile/secure storage |
| `connesso` | health e auth validi | offline, revoca, errore o logout | App Shell e ledger autorizzato |
| `sincronizzazione` | push/pull attivo | connesso, offline, conflitto o errore | operation metadata redatti |
| `offline` | timeout/rete assente | riconnessione o logout | ledger locale client |
| `conflitto` | revisione incompatibile | decisione esplicita utente | record di conflitto, non overwrite |
| `revocato` | revoca locale/remota | nuovo pairing | nessun ledger host |
| `errore` | TLS/auth/protocollo/runtime | retry, recovery o annulla | codice e spiegazione sicura |

## Decisioni PM-0

- **Grant pairing:** monouso e a breve durata; deve essere invalidato dopo consumo, scadenza,
  annullamento o revoca host.
- **Sessione browser:** durata inattiva di 30 minuti, logout esplicito immediato e rinnovo solo
  tramite credenziale già autorizzata; la durata potrà essere parametrizzata in seguito senza
  indebolire il default.
- **Passcode:** minimo 6 cifre/caratteri secondo la UI approvata; 5 errori consecutivi bloccano
  il tentativo per 15 minuti; nessun messaggio distingue se device, token o passcode siano validi.
- **Revoca:** singolo device e tutti i device; la revoca invalida token/sessioni e impedisce push,
  pull e apertura del ledger host.
- **TLS:** nessun listener LAN HTTP; il fingerprint deve essere mostrato nel pairing e il cambio
  fingerprint richiede nuovo consenso, mai accettazione automatica.
- **Telefono offline:** il browser già autorizzato può continuare secondo la coda offline e la
  credenziale non scaduta; nuovo pairing, rinnovo rischioso e revoca richiedono il telefono.
- **PC come host:** nella prima integrazione il computer avvia il Local Hub e pubblica `appUrl`;
  il Pixel 9 orchestra consenso e pairing. Il telefono non espone il proprio database come file.
- **QR:** contiene solo endpoint/grant temporaneo, fingerprint e metadati minimi; mai importi,
  saldi, nomi conto, token permanenti o passcode.
- **Log:** consentiti evento, timestamp, esito e device id hashato; vietati token, passcode, payload
  finanziari, URL con credenziali e materiale chiave.

## Misuse cases e risposta

| Minaccia | Risposta obbligatoria |
|---|---|
| QR fotografato | scadenza breve, monouso, conferma sul telefono e fingerprint |
| replay di grant/token | nonce/consumo registrato, expiry, device binding e revoca |
| host sostituito | certificato/fingerprint mismatch, blocco e nuovo pairing |
| origine contraffatta | allowlist origin e controllo CORS/preflight |
| browser non autorizzato | health senza ledger; endpoint protetti da grant e device id |
| brute force passcode | rate limit, lockout progressivo, messaggi uniformi |
| Wi-Fi diversa | discovery/accesso non sufficiente; TLS e pairing restano obbligatori |
| retry duplicato | idempotency key e operation log append-only |
| conflitto finanziario | record esplicito e decisione utente, nessun last-write-wins |
| crash durante sync | checkpoint, retry sicuro e recovery non distruttivo |
| log compromesso | redazione preventiva e secret scan in CI |

## Gate PM-0

- [x] Ruoli, asset e confini di fiducia definiti.
- [x] Stati e transizioni definiti.
- [x] Grant, sessione, passcode, revoca, TLS e offline definiti.
- [x] Misuse cases e risposte definite.
- [x] Nessun comportamento consente accesso non autenticato o condivisione di database aperti.
- [ ] Review indipendente di sicurezza prima del gate PM-3/PM-6.
- [ ] Test runtime e LAN nelle fasi successive.
