# Roadmap PC Manager Nexora — Local Hub e interfaccia desktop browser

## Obiettivo

Permettere all'utente di avviare il Local Hub dal Pixel 9, autorizzare un computer sulla
stessa rete locale e aprire nel browser del computer la stessa interfaccia desktop Nexora già
definita dal mockup Stitch. Il browser non deve visualizzare una pagina tecnica separata: deve
caricare l'App Shell desktop reale, con il ledger dell'host e lo stato di connessione visibile.

Questa roadmap estende il contratto già definito in `docs/SYNC_SPEC.md` e nell'ADR 0016. Il
Local Hub resta distinto dal backup, ascolta in loopback per default, richiede consenso esplicito
per la LAN e trasferisce soltanto operation log incrementale; non viene mai condiviso un file
SQLite aperto.

## Risultato utente previsto

1. Sul Pixel 9 l'utente apre `Impostazioni > Connessione dispositivi > PC Manager`.
2. Nexora mostra lo stato della rete, il nome della rete, l'indirizzo locale e un avviso di
   sicurezza.
3. L'utente abilita esplicitamente il Local Hub e conferma l'esposizione LAN.
4. Il telefono genera un pairing QR temporaneo, monouso e associato all'host.
5. Sul computer l'utente apre l'indirizzo locale o scansiona il QR.
6. Il browser verifica HTTPS/TLS, fingerprint dell'host e origine autorizzata.
7. L'utente conferma il nuovo dispositivo sul telefono e imposta o inserisce il passcode.
8. Il browser apre la vera App Shell desktop Nexora: sidebar persistente, header, dashboard,
   movimenti, conti, budget, analisi e le altre superfici già disegnate.
9. Telefono e browser mostrano uno stato di connessione coerente: offline, in attesa,
   pairing, connesso, sincronizzazione, conflitto, revocato o errore.
10. Le modifiche passano tramite operation log con idempotency key, cursori, retry e revisione
    dei conflitti; il browser continua a funzionare offline secondo il modello Nexora.

## Vincoli non negoziabili

- Binding loopback di default; nessuna pubblicazione LAN implicita.
- Nessun endpoint ledger senza device id, token a scadenza, fingerprint, origine autorizzata e
  controllo di revoca.
- TLS obbligatorio prima di un listener LAN; niente HTTP in chiaro per la superficie condivisa.
- Pairing fuori banda tramite QR temporaneo e monouso; il QR non contiene dati finanziari.
- Passcode mai nei log, URL, QR, fixture o repository; rate limiting e revoca per dispositivo.
- Il Local Hub non è una destinazione di backup.
- Nessun last-write-wins silenzioso e nessuna sovrascrittura automatica dei movimenti finanziari.
- L'interfaccia desktop deve riusare `AppShell`, token e componenti Nexora; non deve servire il
  prototipo `code.html` direttamente e non deve creare una seconda UI parallela.
- Tutti gli stati devono essere accessibili da tastiera, leggibili con screen reader e verificati
  a 320, 390, 768, 1024 e 1440 px, con zoom 200%.

## Stato di partenza verificato

- `apps/local-host/src/LocalSyncHost.ts` espone health, ledger e operation log, ma l'avvio LAN
  resta volutamente bloccato finché non esiste la configurazione TLS.
- `apps/web/src/settings/SettingsPage.tsx` possiede già un collegamento host manuale tramite
  `/v1/health` e può aprire `appUrl` in una nuova scheda.
- `apps/web/src/settings/localHostConnection.ts` persiste endpoint e stato locale, ma non è
  ancora un workflow di pairing, rete, passcode e stato live end-to-end.
- `docs/SYNC_SPEC.md` definisce `appUrl`, pairing, fingerprint, device id, token a scadenza,
  operation log e conflitti espliciti.
- `packages/ui/src/AppShell.tsx` e i token UI sono il punto di riuso per la visualizzazione
  desktop.

## Fasi della roadmap

### PM-0 — Contratto prodotto e threat model — COMPLETE

**Obiettivo:** congelare il comportamento prima del codice.

- Definire gli stati e le transizioni del PC Manager: `solo-locale`, `hub-in-avvio`,
  `rete-non-idonea`, `in-attesa-pairing`, `pairing-richiesto`, `pairing-confermato`,
  `connesso`, `sincronizzazione`, `offline`, `conflitto`, `revocato`, `errore`.
- Definire i ruoli: telefono come controller/pairing authority; Local Hub come host del ledger;
  browser desktop come client autorizzato.
- Definire asset, confini di fiducia, minacce Wi-Fi condiviso, QR fotografato, replay, host
  sostituito, origine contraffatta, passcode errato e revoca.
- Registrare decisioni su durata grant, timeout inattività, numero tentativi passcode, revoca,
  rinnovo certificato e comportamento quando il telefono è offline.

**Gate:** threat model approvato, nessuna ambiguità su trust model, revoca e recovery.

**Evidence:** `docs/PC_MANAGER_THREAT_MODEL.md`; decisione registrata in
`docs/DECISIONS_LOG.md` il 2026-09-12. Implementazione runtime e review indipendente restano gate
delle fasi successive.

### PM-1 — Contratto Local Hub runtime — COMPLETE

**Obiettivo:** rendere l'host avviabile in modo esplicito e osservabile.

- Introdurre un controller di lifecycle: `start`, `stop`, `restart`, `status`.
- Avviare loopback senza rete; richiedere un comando esplicito per LAN.
- Generare/caricare il materiale TLS tramite primitive di piattaforma già approvate e pubblicare
  fingerprint verificabile.
- Definire porte, binding, cleanup, crash recovery e lock per evitare due hub concorrenti.
- Estendere health con versione protocollo, stato, capability browser, fingerprint non segreto e
  stato di pairing; mai token o passcode.
- Rendere l'host avviabile dal runtime desktop e dal flusso autorizzato Android senza permessi
  Android superflui.

**Gate:** startup/shutdown deterministico, loopback default, LAN fail-closed, health senza segreti,
test di crash/restart e collisione porta.

**Evidence:** `apps/local-hub/src/lib.rs`, `apps/local-hub/README.md`; 25 Rust tests, `cargo fmt
--check`, `cargo test --locked` e `cargo check --locked` PASS. LAN resta bloccata dal lifecycle
controller fino alle fasi pairing/TLS successive.

### PM-2 — Verifica stessa rete e discovery — COMPLETE

**Obiettivo:** guidare l'utente verso il computer corretto senza affidarsi alla sola presenza di
`localhost`.

- Rilevare con API di piattaforma la disponibilità della rete locale senza registrare SSID o
  indirizzi oltre il necessario.
- Pubblicare il servizio solo dopo consenso LAN, usando il contratto `_nexora._tcp` già definito.
- Presentare indirizzo, porta, nome leggibile del dispositivo e fingerprint abbreviato.
- Gestire rete assente, VPN, captive portal, reti isolate/AP isolation, cambio Wi-Fi e indirizzo
  IP cambiato.
- Consentire inserimento manuale dell'indirizzo come fallback, mantenendo le stesse verifiche TLS,
  origine, fingerprint e pairing.

**Gate:** stessa rete verificata o errore spiegato; discovery non espone il ledger; nessun accesso
possibile prima del pairing.

**Evidence:** `apps/local-hub/src/lib.rs` implementa `NetworkAssessment`,
`assess_same_network` e discovery `_nexora._tcp`; test Rust verificano stessa/differente subnet,
loopback e prefisso invalido. La discovery resta solo un hint e non sostituisce TLS/pairing.

### PM-3 — Pairing QR e autorizzazione dispositivo — COMPLETE

**Obiettivo:** associare il browser a uno specifico host e a uno specifico device.

- Generare un grant QR breve, monouso, limitato a scopo, host fingerprint e scadenza.
- Mostrare QR e codice di confronto sul Pixel 9; non includere dati finanziari.
- Dal browser avviare una richiesta di pairing senza ottenere ancora accesso al ledger.
- Sul telefono mostrare nome/origine/fingerprint del browser e richiedere conferma esplicita.
- Creare device id e credenziale per dispositivo a durata limitata; memorizzare il segreto solo
  nello storage sicuro disponibile sul client.
- Implementare rinnovo, logout, revoca singola, revoca globale e lista dispositivi autorizzati.
- Proteggere passcode con rate limiting, timeout, messaggi non rivelatori e blocco progressivo.

**Gate:** test QR scaduto/riusato, token errato, device errato, fingerprint errato, origine
errata, replay, passcode errato, revoca e rinnovo.

**Evidence:** `apps/local-hub/src/lib.rs` espone `POST /v1/pairing/redeem` con grant monouso,
scadenza, host fingerprint e device credential; test HTTP coprono redemption, replay e separazione
dall'autorizzazione ledger. Revoca e token digest restano coperti dal contratto esistente.

### PM-4 — Browser locale e caricamento della Desktop App Shell

**Obiettivo:** quando l'utente avvia il Local Hub dal cellulare, vedere nel PC l'interfaccia
desktop Nexora disegnata, non una schermata di servizio.

- Pubblicare una build browser locale versionata dell'app tramite `appUrl`.
- Definire bootstrap del browser: health → verifica TLS/fingerprint → pairing → sessione →
  apertura ledger host.
- Separare chiaramente la pagina di pairing dalla superficie autenticata; nessun ledger nel DOM
  prima della sessione autorizzata.
- Riutilizzare `AppShell`, `SidebarNavigation`, `TopHeader`, metriche, tabelle e componenti
  accessibili del package UI.
- Mantenere la gerarchia del mockup Stitch: sidebar desktop persistente e collassabile, superficie
  centrale fluida, metriche prima dei dettagli, tabelle dense e responsive.
- Mostrare nel top header: nome dispositivo, stato connessione, ultimo sync, conflitti e azione
  disconnetti/revoca.
- Usare dati reali del ledger host solo dopo autorizzazione; usare dati sintetici esclusivamente
  nei test e negli stati vuoti.
- Gestire refresh, nuova scheda, deep link, sessione scaduta e chiusura del telefono senza
  distruggere i dati locali del browser.

**Gate:** il PC apre tutte le route desktop esistenti con lo stesso App Shell; zero duplicazione
di layout; test screenshot, accessibilità, tastiera, zoom 200% e sei viewport.

**Slice PM-4.1:** completata la guardia bootstrap health nel browser: `appUrl` viene accettato
solo quando il runtime dichiara `running` e un binding valido; Settings mostra lo stato runtime.
Il gate completo PM-4 resta aperto fino alla pubblicazione/serving della build locale, pairing
browser e verifica visuale desktop end-to-end.

**Slice PM-4.2:** il Local Hub può servire `browser_root` con fallback SPA, MIME essenziali,
cache `no-store` e protezione traversal. Il gate completo resta aperto: gli asset pubblici non
concedono accesso ledger e devono essere collegati a sessione/pairing nel seguito.

### PM-5 — Sincronizzazione live e stato connessione

**Obiettivo:** rendere prevedibile la relazione telefono/host/browser.

- Implementare push/pull incrementale con cursori e operation log già definiti.
- Aggiungere heartbeat/health polling con backoff e timeout; evitare polling aggressivo.
- Derivare lo stato visuale da eventi verificabili, non da un semplice booleano `enabled`.
- Mostrare coda locale, ultimo cursor, operazioni in attesa, retry e motivo dell'errore senza
  esporre payload finanziari nei log.
- Gestire offline del PC, offline del telefono, riavvio host, consegna parziale, duplicati e
  ripresa dal checkpoint.
- Presentare i conflitti in una superficie accessibile con decisione esplicita dell'utente; mai
  risolverli tramite sovrascrittura implicita.

**Gate:** test a due client, offline/reload, retry, duplicate delivery, cursor stale, conflitto,
revoca durante sync e recovery dopo crash.

**Slice PM-5.1:** il Local Hub espone push/pull operation log su `/v1/operations`, con pairing,
rate limit, delivery replay protection, cursor e risultati `Applied`/`Duplicate`/`Conflict`.
Il gate completo resta aperto per heartbeat, stato UI, coda browser e recovery visuale.

**Slice PM-5.2:** health e operation endpoints mantengono `SyncRuntimeStatus` con stato `idle`,
`syncing` o `conflict` e cursor monotono. La UI di connessione deve ancora esporre polling,
offline e coda locale.

**Slice PM-5.3:** Settings esegue health polling ogni 5 secondi solo per un host attivo, annulla
il timer alla disattivazione/unmount e mostra runtime, sync state e cursor; se il probe fallisce
passa a `offline` senza cancellare il ledger locale. Il gate finale resta aperto per la coda
offline client e il recovery di consegne parziali.

**Slice PM-5.4:** `LocalHostSyncClient` implementa coda persistente, deduplica per idempotency key,
flush push, mantenimento su conflitto/offline e pull cursor-based con credenziali volatile. Il
gate finale resta aperto fino al recovery visuale di consegne parziali nel flusso completo.

**Slice PM-5.5:** il confine App espone un `localLedgerSyncSink` opt-in: dopo una mutazione locale
riuscita cattura uno snapshot portabile e lo consegna all'adapter senza bloccare il ledger se rete,
pairing o sessione non sono disponibili. Il log registra solo lo stato differito e il nome errore
classificato; payload e credenziali non entrano nei log. Restano da chiudere il sink concreto con
sessione autorizzata, pull/apply esplicito e recovery visuale delle consegne parziali.

### PM-6 — Passcode, sessioni e recovery UX

**Obiettivo:** rendere sicuro e comprensibile l'uso quotidiano.

- Consentire la configurazione del passcode dal telefono prima della pubblicazione LAN.
- Non usare il passcode come sostituto del pairing: il passcode protegge la sessione, il pairing
  autorizza il dispositivo.
- Definire durata sessione, blocco automatico, logout manuale e revoca remota.
- Fornire recovery tramite revoca e nuovo pairing; non mostrare o esportare segreti in chiaro.
- Rendere espliciti i rischi di reti pubbliche e il comportamento quando il certificato cambia.
- Registrare audit metadata redatti: evento, device id hashato, esito, timestamp; mai token,
  passcode, contenuti del ledger o URL con credenziali.

**Gate:** session expiry, lock, logout, revoca, recovery, certificato cambiato, rate limit e
secret scan.

**Slice PM-6.1:** il Local Hub possiede un registro fail-closed per passcode e sessioni: il
passcode viene derivato con salt e iterazioni, le sessioni conservano solo digest, gli errori
sono rate-limited e logout/revoca rimuovono le sessioni. Il contratto è testato ma resta da
esporre via endpoint e UI prima del gate PM-6.

**Slice PM-6.2:** aggiunti `/v1/session/unlock` e `/v1/session/logout`. L’unlock richiede un
device già paired e restituisce solo uno stato; il logout richiede device/sessione validi. La
configurazione passcode dal telefono e l’obbligo sessione sulle API ledger/sync restano aperti.

**Slice PM-6.3:** aggiunto `/v1/session/configure` per un device già paired; quando il passcode è
configurato, `/v1/operations` richiede anche `x-nexora-session-token`. I timestamp delle richieste
non controllano più expiry/rate limit lato server. Test HTTP copre configure → unlock → sync → logout.
Restano UI telefono, gestione sessione browser e recovery/certificato cambiato.

**Slice PM-6.4:** il client web espone configure/unlock/logout typed con credenziali volatili; il
token sessione non entra nella connessione persistita. Restano da collegare il pairing UI, il
session state browser e la recovery esplicita.

**Slice PM-6.5:** `LocalHostSessionController` mantiene la sessione solo in memoria e il client
sync aggiunge `x-nexora-session-token` soltanto quando disponibile. Logout cancella il token anche
su errore di rete. Restano pairing UI, session expiry visibile, revoca/recovery e certificato.

**Slice PM-6.6:** `/v1/pairing/revoke` rimuove un device autorizzato e invalida contemporaneamente
le sue sessioni. Il flusso è testato su device/token/sessione; resta da esporre nel controller
telefono/browser e da completare la recovery con nuovo pairing.

### PM-7 — Packaging e avvio operativo

**Obiettivo:** eliminare i passaggi tecnici per l'utente.

- Includere Local Hub e asset browser nel packaging Tauri Desktop per Windows/macOS.
- Definire l'avvio dal menu dell'app desktop e l'avvio autorizzato dall'app Android.
- Mostrare al telefono istruzioni minime: “Apri questo indirizzo” oppure QR; nessun requisito
  Node/terminal per l'utente finale.
- Gestire aggiornamento protocollo e incompatibilità tra client/host con messaggio operativo.
- Definire firewall/permesso LAN con richiesta stretta e spiegata, senza capability ampie.

**Gate:** installer pulito, startup senza terminale, upgrade/restart, firewall rifiutato, host
non raggiungibile e version mismatch.

**Slice PM-7.1:** il Tauri Desktop espone comandi `pc_manager_start/status/stop` collegati al
`LocalHubRuntime` Rust reale. L’avvio usa loopback e `LocalHubState` isolato; il lockfile Tauri
registra la dipendenza path e `cargo check --locked` passa. Asset browser, pairing controller,
LAN/firewall e installer restano aperti.

**Slice PM-7.2:** `dist` viene incluso nel bundle Tauri come resource `browser` e il comando start
configura `browser_root` dalla resource directory con `appUrl` loopback. `tauri build --debug
--no-bundle` ha prodotto `apps/web/src-tauri/target/debug/nexora.exe`; pairing/LAN/firewall e
installer restano aperti.

**Slice PM-7.3:** Settings espone in Tauri il controllo start/stop/status del Local Hub desktop e
nasconde la capability nella PWA. Il feedback chiarisce loopback e consenso LAN; pairing, apertura
browser automatica, firewall e installer restano aperti.

**Slice PM-7.4:** `tauri build --debug` ha prodotto entrambi i bundle Windows x64:
`Nexora_0.5.0-1_x64_en-US.msi` e `Nexora_0.5.0-1_x64-setup.exe`. Il gate installer passa; firewall,
upgrade/restart e verifica browser post-install restano aperti.

**Slice PM-7.5:** il probe web rifiuta `apiVersion` diversa da `SUPPORTED_LOCAL_HOST_API_VERSION`
con `host_protocol_version_mismatch`, senza persistere l’host incompatibile. Restano smoke test
post-install, firewall, upgrade/restart e gate dispositivo.

### PM-8 — Gate finale su Pixel 9 e desktop

**Obiettivo:** dimostrare il flusso reale completo.

- Pixel 9 release/debug autorizzato: avvio hub, rete, QR, conferma, passcode, stato e revoca.
- Windows e macOS: browser supportato, nuova scheda, refresh, deep link, desktop layout e
  chiusura host.
- Test LAN reale su rete privata controllata; nessun dato reale nei fixture o nei log di test.
- Verificare importo/saldo/trasferimento prima e dopo sync, assicurando che i trasferimenti restino
  neutrali.
- Eseguire threat-model tests, pairing negative tests, TLS tests, LAN integration tests, full
  unit/typecheck/build/E2E, recovery e performance.
- Allegare evidenze screenshot del mockup desktop, log redatti, risultati test e matrice
  dispositivo/browser/OS.

**Gate finale:** `PC_MANAGER_FINAL_GATE_PASS`, 0 P0/P1/P2 aperti, review di sicurezza indipendente,
working tree pulito e documentazione/stato aggiornati.

**Stato di esecuzione 2026-09-13:** PM-0–PM-7.5 hanno evidenze locali e commit pubblicati. Il
Pixel 9 autorizzato è rilevato, la release `0.5.0-1` è stata installata con `adb install -r`
e `MainActivity` è rimasta in foreground senza marker di crash. Il gate loopback desktop è ora
PASS: il pulsante Tauri avvia il Local Hub, `127.0.0.1:43173` resta in ascolto e `/v1/health`
restituisce `status: ok`, `runtime_state: running`, `binding: loopback`, `sync_state: idle`.
Il root browser e la route `/settings` rispondono 200; `adb reverse tcp:43173 tcp:43173` è attivo
e il Pixel raggiunge la socket via USB (`toybox nc` exit 0). PM-8 resta aperta: pairing UI,
LAN/TLS reale, sync/revoca/recovery e prova browser dal device non sono ancora dimostrati.

**Avanzamento PM-8:** il gate software deterministico copre anche il serving dell’asset reale
`apps/web/src-tauri/target/debug/browser/index.html`; il test Local Hub resta verde con 34 casi,
inclusi shell browser, pairing monouso, sessione passcode, sync HTTP, replay/cursor e revoca.
Questa evidenza non sostituisce la prova su dispositivo fisico, rete LAN reale, TLS e browser
desktop post-install.

**Slice PM-8 pairing UI — 2026-09-13:** il runtime genera ora un invito monouso a entropia OS,
con scadenza di cinque minuti e grant conservato solo come digest; Tauri lo espone al desktop e
Settings consente di incollarlo, creare una credenziale device volatile, redimere il grant e
revocare il device. Test Rust `34/34`, bridge desktop `2/2`, connessione/Settings `19/19` e
typecheck web PASS. Restano passcode/sessione UI, LAN/TLS reale, sync/recovery e prova fisica
del pairing dal Pixel.

## Matrice di test minima

| Area | Casi obbligatori |
|---|---|
| Lifecycle | start, stop, restart, crash, porta occupata, loopback default |
| Rete | Wi-Fi assente, stessa rete, reti diverse, cambio IP, VPN, rete isolata |
| TLS | certificato valido, fingerprint cambiato, hostname errato, downgrade HTTP rifiutato |
| Pairing | QR scaduto, QR riusato, origin errata, device errato, token errato, replay |
| Passcode | configurazione, errore, rate limit, lock, logout, sessione scaduta, recovery |
| Sync | push/pull, cursor, retry, duplicato, consegna parziale, offline, conflitto, revoca |
| UI desktop | mockup, App Shell, route, sidebar, header status, focus, tastiera, WCAG, zoom 200% |
| Dati | trasferimenti neutrali, precisione monetaria, nessun overwrite, restore/recovery |
| Packaging | Windows/macOS, Android Pixel 9, avvio senza terminale, firewall, version mismatch |
| Privacy | secret scan, log redatti, QR senza dati finanziari, nessuna credenziale in URL |

## Criteri di completamento

- Un utente può partire dal Pixel 9 e arrivare alla Desktop App Shell nel browser senza terminale.
- Il PC non vede il ledger prima del pairing confermato.
- Una rete diversa, un fingerprint diverso, un token scaduto o un device revocato non ottengono
  accesso.
- La UI del browser è quella desktop Nexora già disegnata e riusa i componenti reali.
- Il browser resta offline-capable e recupera senza duplicare operazioni.
- Conflitti e stati di connessione sono visibili e comprensibili.
- Nessun trasferimento interno viene classificato come entrata o spesa.
- Le evidenze di sicurezza, test, responsive UI, packaging e recovery sono archiviate.

## Decisioni ancora necessarie prima dell'implementazione

1. Il Local Hub viene avviato dal runtime Android come host temporaneo oppure il telefono comanda
   sempre un host desktop separato? La roadmap assume: telefono come controller di pairing e PC
   come host del ledger/browser, coerente con l'attuale contratto Local Hub.
2. Quali browser desktop supportare nella prima release: Chromium/Edge/Chrome e Safari macOS,
   oppure solo Chromium-based?
3. Durata esatta di grant, sessione e passcode lockout.
4. Modalità di provisioning TLS per sviluppo, produzione e rete domestica.
5. Se l'apertura browser deve essere automatica tramite intent/deep link o manuale tramite URL/QR.

Le decisioni sopra non autorizzano ancora una modifica architetturale: vanno chiuse in un ADR o
nel decision log prima di PM-1/PM-3.
