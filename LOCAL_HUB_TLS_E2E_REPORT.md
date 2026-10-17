# Local Hub TLS E2E report

Data: 2026-10-17 (Europe/Rome)
Branch: `codex/pc-manager-local-browser`  
Commit verificato: `d4d6f3661a207e3a3e8b924b47a89e4d5bcc2637`

## Esito

**PARZIALE — il browser LAN e il servizio API sono verificati; il pairing TLS PC↔telefono non è ancora chiuso.**

La build Android aggiornata ora serve la App Shell dal Local Hub anche su Android, dove gli asset
sono incorporati nell'APK e non sono leggibili come file normali. La prova fisica dal PC ha restituito
HTTP 200 per `/`, `/settings` e `/v1/health` con il Local Hub in stato `running`.

Il Local Hub Android si avvia e la rete LAN è raggiungibile. Il client Windows aggiornato
visualizza il flusso di invito pairing, ma l'azione di autorizzazione termina con il messaggio
generico `Pairing non completato: verifica invito, host e scadenza.`. Per questo non dichiaro
PASS per il criterio E2E completo e non dichiaro verificata una mutazione PC applicata allo
SQLite del telefono.

## Ambiente e verifiche fisiche

- Pixel 9, seriale ADB `46060DLAQ002XQ`, autorizzato (`adb devices` = `device`).
- APK arm64 firmato del run CI `38147745202` installato con `adb install -r`: `Success`.
- Nessun uninstall, clear data, reset o modifica ai dati finanziari eseguita.
- Local Hub Android: `running`, porta `43173` in ascolto.
- IP Wi-Fi osservato sul telefono: `192.168.1.5`.
- `Test-NetConnection 192.168.1.5 -Port 43173`: **PASS**.
- `GET /v1/health` con client diagnostico: **PASS**, `status=ok`, `binding=lan`, `runtime_state=running`.
- `GET /` dal PC: **PASS**, `200 text/html`.
- `GET /settings` dal PC: **PASS**, `200 text/html`.
- `GET /v1/health` dal PC: **PASS**, `200 application/json`.
- Questa prova usa `curl -k` solo per raggiungere il certificato temporaneo autofirmato; non
  costituisce la verifica del pairing o del trust browser.

## Pairing TLS

- Il telefono ha generato un invito con endpoint HTTPS, fingerprint, identità host e certificato.
- Il pulsante mobile è stato verificato cliccabile dopo la correzione dell'overlay della bottom
  navigation.
- Il client Windows aggiornato è stato compilato localmente dallo stesso commit e mostra il
  campo `Invito pairing` e `Autorizza questo dispositivo`.
- L'invito è stato trasferito tramite clipboard locale controllata, senza stamparne il contenuto.
- L'autorizzazione ha restituito **FAIL** a livello applicativo con messaggio generico.
- Conseguenza: bootstrap autenticato, pull/push, outbox e mutazione reale PC→SQLite telefono sono
  **NOT TESTED / BLOCKED** in questa sessione. Le prove automatiche e il test SQLite sintetico
  restano validi, ma non sostituiscono questo passaggio fisico.

## Gate automatici

Run CI: [38147745202](https://github.com/roisberguillen/Nexora/actions/runs/38147745202)

- `verify`: **PASS**
- Android arm64 pipeline: **PASS**
- Android arm64 signed: **PASS**
- Windows desktop: **PASS**
- APK firmato prodotto e installato sul Pixel: **PASS**

## Correzioni già verificate

- Il Local Hub Android risolve gli asset incorporati dell'APK tramite l'asset resolver Tauri;
  la App Shell non restituisce più 404 dal browser LAN.

- Rilevazione IP LAN Android con priorità a Wi-Fi/Ethernet.
- Identità TLS Android temporanea in memoria per evitare il blocco di avvio causato dal percorso
  Keystore biometrico.
- Invito pairing generato dal telefono con fingerprint e certificato.
- Controlli UI Android riposizionati sopra la navigazione fissa.
- Pinning TLS nativo, controllo dell'identità host e blocco di indirizzi esterni restano attivi.

## Prossimo blocco tecnico

Serve esporre l'errore interno del redeem/persistenza nel client Windows durante una riproduzione
controllata, quindi correggere soltanto il punto che fallisce e ripetere pairing, bootstrap e una
mutazione sintetica verificata direttamente nello SQLite host. Finché quel test non passa, lo stato
corretto della modalità è **INCOMPLETE**.
