# ADR 0023: accesso Local Hub dal PC con una sola azione

## Stato

Deferred — la superficie Local Hub è stata rimossa dal prodotto attivo il 2026-10-18; protocollo e revisione di sicurezza restano aperti per una fase futura.

## Contesto

Il flusso corrente richiede avvio dell'hub, trasferimento di un invito, pairing e configurazione/sblocco della sessione. L'utente vuole avviare il Local Hub sul telefono e usare Nexora dal PC sulla stessa Wi-Fi senza inserire codici, passcode o approvare un nuovo PC. Ha specificato che un PC nuovo deve poter leggere **e modificare** il ledger. Il gate reale Pixel → PC non è ancora chiuso; un avvio PC è terminato con `NX-TIMEOUT-001` durante l'accesso al vault locale delle credenziali.

## Obiettivo UX

1. Sul telefono: un solo comando «Avvia Local Hub» e uno stato chiaro.
2. Sul PC: Nexora individua l'hub e apre il ledger del telefono in lettura e modifica senza inserimento manuale.
3. Alla disconnessione o allo stop: il PC mostra uno stato esplicito, senza sostituire silenziosamente il ledger remoto con quello locale.

## Conseguenza della scelta

Se la sola appartenenza alla Wi-Fi autorizza un PC mai visto prima, qualsiasi altro dispositivo che raggiunga il listener può impersonare quel PC. Poiché il requisito include scrittura, quel dispositivo potrebbe leggere saldi e movimenti **e modificare il ledger**. HTTPS protegge il trasporto ma non identifica il client. Questa modalità contraddice l'autorizzazione per dispositivo in ADR 0016 e ADR 0020; non può essere introdotta come semplice rimozione dei controlli UI.

## Decisione tecnica ancora da approvare

Il perimetro richiesto è lettura e scrittura. Restano da definire la protezione del primo collegamento, la gestione di reti condivise/pubbliche, il rinnovo dell'identità TLS, la revoca e il recovery. Valutare un canale di fiducia automatico che non richieda codici, senza dichiarare sicura la sola Wi-Fi. Non modificare i gate di autorizzazione del backend finché queste scelte e la revisione indipendente non sono chiuse.

## Gate

- Revisione di sicurezza indipendente e aggiornamento del threat model.
- Test negativi per client estraneo sulla stessa rete, replay, rete pubblica, cambio certificato e revoca.
- Verifica browser/PC del certificato e della discovery senza bypass degli avvisi di sicurezza.
- Gate fisico Pixel → PC con ledger sintetico, avvio, accesso, stop e recovery.
- `pnpm verify` e test Local Hub completi prima della pubblicazione.
