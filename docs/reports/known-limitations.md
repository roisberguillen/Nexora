# Limitazioni note — verifica roadmap di ripristino

Data: 2026-07-30

## Stato verificato

- `pnpm verify`, `pnpm doctor`, `pnpm manifest:check` e `pnpm audit --prod` sono verdi.
- La CSP di sviluppo e preview è verificata con l'avvio reale di SQLite WebAssembly e con
  l'E2E della shell sulle viewport previste.
- Gli E2E Playwright sono stati eseguiti a gruppi sulle viewport 320, 375, 768, 1024 e
  1440 px: i gruppi registrati sono verdi; gli skip sono condizionati da capacità del
  browser o baseline deliberate.
- Il browser integrato usato per il controllo visuale non espone IndexedDB, OPFS, Worker o
  SharedArrayBuffer al runtime della pagina. In tale ambiente Nexora visualizza correttamente
  il recovery, ma non è possibile usarlo come prova di una dashboard con dati persistiti.

## Requisiti della roadmap non ancora provati

1. Il recovery verifica e ripristina un backup portabile in un archivio temporaneo poi rimosso,
   ma non offre ancora l'apertura navigabile di quella copia come sessione separata.
2. Esistono prove Chromium su IndexedDB e OPFS reali con 100.000 movimenti, ma non sono ancora
   una campagna ripetuta completa né coprono il dataset completo della roadmap, rendering o
   memoria. La lettura della lista completa ha misurato circa 1,6 s su IndexedDB e 3,2 s su
   OPFS, oltre la soglia preliminare di un secondo per ricerca o filtro.
3. Web Locks serializza il bootstrap quando disponibile e la prova browser copre cinque schede
   simultanee e 50 reload. Restano da provare chiusure durante scrittura, quota insufficiente e
   aggiornamento del Service Worker.
4. I 34 skip E2E non sono fallimenti, ma richiedono una matrice esplicita di capacità prima
   che possano sostenere una dichiarazione di copertura totale.

## Condivisione PC e smartphone

`localhost` e `127.0.0.1` identificano il dispositivo corrente. IndexedDB e OPFS sono
vincolati a origine e profilo browser, quindi non possono costituire un database condiviso
tra PC e smartphone. Un requisito di condivisione richiede una nuova architettura: servizio
LAN autenticato o sincronizzazione esplicita con replica, conflitti, backup e autorizzazioni.
Questa capacità non è inclusa nella PWA offline-first corrente.

## Conseguenza per il rilascio

Nexora può essere verificata come PWA locale per le superfici coperte dai test, ma non deve
essere dichiarata pronta per database condiviso PC/smartphone né per hardening completo della
roadmap finché i punti sopra non hanno prove ripetibili.
