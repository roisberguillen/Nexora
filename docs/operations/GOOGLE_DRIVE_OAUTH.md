# Google Drive OAuth

Nexora uses Google Identity Services in the browser with the least-privilege
`https://www.googleapis.com/auth/drive.appdata` scope. Backups are encrypted before upload;
no financial data, passphrase or encryption key is sent in clear text.

Create an OAuth client of type **Web application** in Google Cloud Console. Add the exact local
and production origins as Authorized JavaScript Origins, then set `VITE_GOOGLE_CLIENT_ID` in a
local `.env` file and `VITE_GOOGLE_DRIVE_ENABLED=true`. Do not create or expose a client secret.

Il Client ID configura Nexora una sola volta per il deployment: non identifica l'utente e non deve
essere chiesto a ogni persona. Dopo l'apertura verificata del ledger locale, Nexora presenta invece
un onboarding opzionale. Solo il pulsante **Collega Google Drive** avvia Google Identity Services
con `prompt=select_account`, così ogni utente sceglie e autorizza il proprio account Google. La
dashboard resta utilizzabile con **Continua senza Drive** e il rifiuto del consenso non blocca i
dati locali. La scelta di non collegarsi evita nuove richieste soltanto per la sessione corrente
del browser; in una nuova sessione l'onboarding può essere riproposto.

Tokens are kept in memory only and are discarded on disconnect or page close. A missing client ID
leaves cloud backup disabled while local encrypted backups remain available.

## Account, cartella e ciclo di vita

L'account è selezionato esplicitamente nella schermata di consenso Google. Lo scope `drive.appdata`
non consente di sfogliare cartelle arbitrarie: Nexora usa la propria cartella privata
`appDataFolder`, isolata dai file Drive visibili e dalle altre app. Questa è la “cartella Nexora”
supportata; ampliare lo scope richiede un nuovo threat model e un ADR.

Il client ID è pubblico e validato come client Web `*.apps.googleusercontent.com`; non esistono
client secret nel browser. Token, passphrase e chiavi non sono scritti in localStorage,
sessionStorage, cronologia o log. Disconnessione e chiusura pagina eliminano lo stato OAuth volatile.

## Upload, verifica e restore

1. Il Backup Engine crea e autoverifica localmente l'archivio cifrato.
2. Il provider carica archivio e soli metadati tecnici nella cartella privata. Gli upload POST non
   vengono ritentati automaticamente, per non creare duplicati dopo risposte di rete ambigue.
3. La lista ignora file senza metadati Nexora validi. Dimensione massima: 512 MiB.
4. Prima del restore, download, dimensione, checksum e contenuto cifrato sono verificati in sola
   lettura; nessuna scrittura avviene finché l'utente non conferma in un dialogo separato.
5. Il restore usa checkpoint e rollback del Backup Engine condiviso.

La cancellazione remota non fa parte del normale flusso backup. È disponibile soltanto come scelta
esplicita nel ripristino totale e opera sui backup Nexora validi restituiti da `appDataFolder`.

## Collaudo del deployment

Configurare un account di test senza dati personali, registrare l'origine esatta (per esempio
`http://127.0.0.1:4173`) e verificare consenso, upload, nuovo avvio, elenco, verifica read-only,
conferma restore e disconnessione. Se le variabili non sono presenti, l'interfaccia deve restare
disabilitata senza degradare backup manuale o ledger locale.
