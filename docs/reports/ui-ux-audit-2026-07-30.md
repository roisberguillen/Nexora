# Audit UI/UX — mobile e desktop

Data: 2026-07-30. Superfici osservate: dashboard e Movimenti su preview di produzione, a 320×800 e 1440×1000, con dataset dimostrativo sintetico. La navigazione è stata effettuata nel browser reale.

## Esiti positivi verificati

- Avvio guidato comprensibile: le fasi del bootstrap sono nominate e visibili.
- La dashboard mobile mantiene azioni principali e navigazione inferiore raggiungibili a 320 px.
- Le righe Movimenti passano a layout con etichette su schermo stretto, senza overflow orizzontale osservato.
- Il desktop espone sidebar, ricerca e informazioni di integrità senza sovrapposizioni dopo il ripristino dello scroll di rotta.
- Le verifiche E2E hanno confermato accessibilità shell e assenza di overflow sulle viewport 320, 375, 768, 1024 e 1440 px.

## Criticità rilevate

| Priorità | Superficie | Criticità | Impatto | Azione proposta |
|---|---|---|---|---|
| P0 | PC + smartphone | `localhost`/`127.0.0.1`, OPFS e IndexedDB sono locali a dispositivo e profilo: non condividono il ledger fra PC e smartphone. | Il requisito di database condiviso non è realizzabile con la PWA corrente. | Nuovo servizio LAN autenticato o protocollo di sync con conflitti, backup e autorizzazioni. |
| P1 | Mobile Movimenti | La densità della riga resta elevata, pur con etichette compatte, azioni separate e safe area già applicate. | L’azione rapida su smartphone può rimanere lenta. | Card compatta con menu azioni nel prossimo ciclo UX. |
| P1 | Liste grandi | La UI limita la tabella a 100 righe ma carica ancora il dataset completo dal backend. | Con 100k record, apertura e filtro non raggiungono la soglia UX. | Query paginata/cursore sul repository e ricerca server-side/indice. |
| P1 | PWA update | Le vecchie sessioni possono rimanere su asset storici fino a un aggiornamento del Service Worker. | Rischio di UI/schema non allineati. | Prompt di update già introdotto; aggiungere E2E con due build e migrazione senza perdita dati. |
| P2 | Desktop | I bundle principali superano 500 kB minificati. | Primo caricamento e update più pesanti, soprattutto su rete mobile. | Spezzare route/moduli pesanti e misurare LCP/TTI. |
| P2 | Accessibilità | Non esiste ancora audit completo a zoom 200% e screen reader per ogni dialogo/pagina. | Copertura AA non dimostrata per tutte le superfici. | Matrice axe, zoom e tastiera per pagina e dialogo. |

## Nota sulla condivisione

Una pagina servita su `localhost` dal PC non è raggiungibile dallo smartphone: sul telefono `localhost` indica il telefono stesso. Esporre il PC in LAN richiede un indirizzo LAN, TLS o una decisione esplicita sulla sicurezza del contesto, autenticazione, controllo degli accessi e un datastore condiviso. Non è una modifica cosmetica della PWA.
