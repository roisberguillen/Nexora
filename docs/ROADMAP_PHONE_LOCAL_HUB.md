# Roadmap Nexora — Phone Local Hub verso PC Desktop

## Obiettivo

Permettere all'utente di aprire Nexora sul Pixel 9, avviare esplicitamente un Local Hub
temporaneo sul telefono e collegare il PC alla stessa rete per visualizzare la vera Desktop App
Shell Nexora con i dati del ledger del telefono.

Il Pixel è l'host del ledger per la durata della sessione; il PC è un client autorizzato. Il
Local Hub trasferisce soltanto operation log incrementale e snapshot portabili necessari al
bootstrap: non viene mai condiviso un file SQLite aperto e il Local Hub resta separato dal backup.

## Flusso utente target

1. Sul Pixel l'utente apre `Impostazioni > Connessione dispositivi > PC Manager`.
2. Nexora verifica rete, indirizzo locale e disponibilità del runtime Android.
3. L'utente abilita esplicitamente `Avvia Local Hub sul telefono` e conferma l'esposizione LAN.
4. Il telefono mostra indirizzo/QR temporaneo, fingerprint e stato `In attesa di collegamento`.
5. Sul PC l'utente apre il browser locale o scansiona il QR.
6. Il telefono mostra il PC richiedente e l'utente conferma pairing e passcode.
7. Il PC apre la Desktop App Shell Nexora e legge il ledger tramite API autorizzate.
8. Push/pull, cursori, retry e conflitti mantengono PC e telefono coerenti anche offline.
9. Stop dal telefono, timeout, cambio rete o revoca chiudono la sessione senza cancellare dati.

## Invarianti

- Il Local Hub Android è spento per default e non resta in ascolto dopo stop, logout o crash
  recuperato.
- LAN, discovery e pairing sono sempre opt-in; stessa rete non equivale ad autorizzazione.
- HTTPS/TLS, fingerprint, device id, grant monouso, session token e revoca proteggono ogni API
  ledger/sync.
- Il passcode protegge la sessione e non sostituisce il pairing.
- I segreti usano Android Keystore o il secure storage già approvato; mai localStorage, URL, QR,
  log o fixture.
- Nessun trasferimento interno diventa entrata o spesa; nessun conflitto usa last-write-wins.
- Il PC non riceve dati ledger prima del pairing confermato e della sessione sbloccata.
- Il PC conserva il proprio ledger offline; l'host telefono viene trattato come peer sincronizzato,
  non come destinazione backup.

## Fasi

### PMA-0 — Contratto e inversione del ruolo — COMPLETE

Registrare il ruolo del Pixel come host temporaneo, il PC come client, i confini di fiducia, gli
stati runtime e le decisioni su stop, timeout, revoca, offline e recovery.

Gate: ADR e threat model aggiornati; nessun accesso al ledger senza pairing/sessione; nessuna
condivisione del database aperto.

Evidence: `docs/ADR/0020-phone-local-hub-host.md`, questo documento e
`.codex/state/checkpoints/2026-09-14-roadmap-phone-local-hub-android.md`.

### PMA-1 — Runtime host Android

Portare il runtime Local Hub nel target Tauri Android con lifecycle esplicito `start/stop/status`,
binding controllato, foreground/lifecycle handling Android, shutdown su stop e recovery dopo crash.
Verificare quali permessi sono realmente necessari e rifiutare permessi superflui.

Gate: compile Android, test lifecycle, loopback default, LAN fail-closed, nessun listener dopo stop.

**Slice PMA-1.1 — 2026-09-14:** aggiunti comandi Tauri condivisi `phone_local_hub_start`,
`phone_local_hub_status` e `phone_local_hub_stop`, con stato nativo condiviso e binding
loopback-only. Settings identifica il runtime Android e mostra il controllo del Local Hub del
telefono; il controllo desktop non viene mostrato sul Pixel. La build ufficiale Tauri Android
arm64 ha prodotto APK/AAB debug e il bridge web passa 5/5 test. Il gate PMA-1 resta aperto per
lifecycle foreground realmente osservato, LAN/TLS, permessi e test stop/restart sul dispositivo.

**Slice PMA-1.2 — 2026-09-14:** aggiunta una guardia di foreground globale: quando la WebView
Android diventa `hidden`, Nexora invoca lo stop del Local Hub; il cleanup rimuove il listener e
gli errori di stop non espongono segreti né bloccano il ledger locale. Test guardia, bridge e
Settings `18/18` PASS.

**PMA-1 COMPLETE / PASS — 2026-09-14:** build release arm64 firmata con certificato atteso,
installazione in-place sul Pixel 9 (`adb install -r` PASS), avvio foreground senza marker di
crash, start/stop/restart del Local Hub dalla Settings UI, health `200` su `127.0.0.1:43173`,
`runtime_state=running`, `binding=loopback` e `sync_state=idle`. Dopo stop non è rimasto alcun
listener `LISTEN`; dopo HOME/background il health è diventato non disponibile e il listener è
scomparso. Il restart successivo è tornato `200` e il Local Hub è stato lasciato attivo.
Manifest Android: solo `INTERNET`; nessun permesso storage/Bluetooth/foreground-service. PMA-2 è
autorizzata.

### PMA-2 — Ledger host e bridge sicuro

Collegare il ledger SQLite nativo del Pixel alle API operation-log del Local Hub senza esporre il
file. Implementare snapshot bootstrap, push/pull incrementale, cursor, idempotency e transazioni
atomiche già supportate dal dominio.

Gate: adapter parity, precisione monetaria, trasferimenti neutrali, replay/duplicate/conflict e
recovery dopo consegna parziale.

**Slice PMA-2.1 — 2026-09-14:** il phone-host ora può collegare il runtime allo stesso file
SQLite nativo `nexora.db` usato dall’app. `sync_operations`, `sync_revisions` e
`sync_operation_deliveries` persistono payload operation-log, revisioni, cursor, idempotenza e
delivery replay; le route HTTP protette usano il backend durevole quando il runtime Android lo
fornisce, mentre il percorso desktop di test resta compatibile. Rust Local Hub `36/36`, Tauri
`cargo check --locked` e typecheck local-host PASS. Restano aperti snapshot/bootstrap e
applicazione atomica dei payload alle tabelle ledger, quindi PMA-2 non è ancora chiusa.

**Slice PMA-2.2 — 2026-09-14:** aggiunto il bootstrap autenticato `/v1/bootstrap`, con schema
versionato, cursor e operation-log durevole. I payload del phone-host devono essere JSON tipizzati
con operazione `upsert/delete`, entity allowlistata, `entity_id` coerente, importi in stringhe
intere e valute ISO maiuscole; la validazione avviene dentro la stessa transazione che registra la
delivery, quindi un payload invalido non lascia delivery, operation o revisioni parziali. Sono
coperti rifiuto atomico, bootstrap dopo riapertura, pairing HTTP e replay. L'applicazione del
payload alle tabelle di dominio e il controllo completo delle invarianti trasferimenti restano il
prossimo slice PMA-2.3; PMA-2 resta in progress. La verifica fisica della build aggiornata sul Pixel è
completata il 2026-09-14: APK universal release firmato con schema v2, installato con `adb install -r`
senza reset dati, app avviata sul Pixel 9 autorizzato, `/v1/health` 200 in loopback con runtime
`running`, stop con health non raggiungibile, restart con health 200 e HOME/background con listener
assente. Il runtime è stato lasciato nuovamente `running`. PMA-2 resta in progress.

**Slice PMA-2.3 — 2026-09-14:** il ramo SQLite durevole applica i payload `transaction` e
`transfer` nella stessa transazione che registra delivery, operation e revision. I movimenti
richiedono campi tipizzati e vengono scritti in minor-unit stringa; foreign key, check dello schema
e trigger nativi impediscono valute/conto/date incoerenti e trasferimenti non bilanciati. Le gambe
di un trasferimento vengono quindi registrate come movimenti neutrali e il bundle viene creato solo
quando debit/credit rispettano le invarianti del ledger. Sono coperti replay/idempotenza, rollback
su payload invalido, precisione e bundle bilanciato/non bilanciato (`38/38` test Local Hub).
Il build/install Android aggiornato e la verifica fisica sul Pixel restano il gate di chiusura di
PMA-2.3; PMA-2 resta in progress.

### PMA-3 — Discovery, pairing e autorizzazione dal telefono

Pubblicare `_nexora._tcp` solo dopo consenso, generare QR/grant monouso, mostrare fingerprint e
nome del PC sul Pixel, confermare esplicitamente il client e conservare credenziali nel secure
storage volatile/approvato.

Gate: grant scaduto/riusato, fingerprint/origin/device errati, rate limit, revoca singola/globale,
rete diversa e attacco replay.

### PMA-4 — Browser desktop client

Aggiungere al browser desktop il bootstrap `health → fingerprint → pairing → sessione → ledger`,
riusando AppShell e le superfici desktop esistenti. Il PC deve mostrare stato host telefono,
ultimo sync, offline, conflitti, stop/revoca e sessione scaduta.

Gate: tutte le route autorizzate, nessun ledger nel DOM prima della sessione, tastiera, screen
reader, zoom 200% e viewport 320–1440 px.

### PMA-5 — Sync bidirezionale offline-first

Collegare operation-log del telefono e del PC con cursori indipendenti, queue persistente, retry,
deduplica, consegna parziale e revisione esplicita dei conflitti.

Gate: telefono offline, PC offline, riavvio, duplicati, cursor stale, conflitto e recovery senza
perdita o sovrascrittura silenziosa.

### PMA-6 — Lifecycle, rete e sicurezza operativa

Gestire cambio Wi-Fi/IP, rete isolata, VPN, certificato cambiato, timeout, lock, logout, revoca,
stop del Local Hub e nuovo pairing. Redigere audit metadata senza payload finanziari.

Gate: threat-model tests, TLS tests, secret scan, recovery tests e nessun permesso Android ampio.

### PMA-7 — Packaging Android/desktop

Integrare avvio e stop nella UI mobile, aprire o copiare il link sul PC senza terminale, includere
asset browser e messaggi per firewall/version mismatch. Preparare build Pixel debug/release e
desktop Windows/macOS.

Gate: APK/AAB arm64, installazione/launch Pixel, packaging desktop, upgrade/restart e rifiuto
firewall gestito in modo comprensibile.

### PMA-8 — Gate reale Pixel → PC

Dimostrare il percorso completo su Pixel 9 e PC sulla stessa rete privata controllata con dati
sintetici: avvio, discovery, pairing, passcode, visualizzazione Desktop App Shell, lettura,
modifica sintetica, sync, offline, conflitto, revoca e recovery.

Gate finale: `PHONE_LOCAL_HUB_FINAL_GATE_PASS`, 0 P0/P1/P2, review sicurezza indipendente, test
globali verdi, evidenze UI e working tree senza modifiche tracciate non pubblicate.

## Decisioni aperte da chiudere prima di PMA-1

1. Se Android richiede un foreground service dedicato per mantenere il listener mentre Nexora è in
   background; in tal caso il permesso e la notifica devono essere minimali e documentati.
2. Se il ledger primario resta quello del Pixel durante la sessione o se il PC conserva una copia
   peer offline: la roadmap assume peer sync, mai sostituzione silenziosa.
3. Browser desktop iniziali: Chromium/Edge/Chrome su Windows; Safari macOS solo dopo gate dedicato.
4. Durata grant/sessione e policy lockout: riusare i default PM-0 già approvati salvo ADR compatibile.
