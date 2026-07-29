# Limitazioni note — verifica roadmap di ripristino

Data: 2026-07-30

## Stato verificato

- `pnpm verify`, `pnpm doctor`, `pnpm manifest:check` e `pnpm audit --prod` sono verdi.
- Gli E2E Playwright sono stati eseguiti a gruppi sulle viewport 320, 375, 768, 1024 e
  1440 px: 121 test passati e 34 skip condizionati da capacità del browser o baseline
  deliberate.
- Il browser integrato usato per il controllo visuale non espone IndexedDB, OPFS, Worker o
  SharedArrayBuffer al runtime della pagina. In tale ambiente Nexora visualizza correttamente
  il recovery, ma non è possibile usarlo come prova di una dashboard con dati persistiti.

## Requisiti della roadmap non ancora provati

1. Il recovery verifica e ripristina un backup portabile in un archivio temporaneo poi rimosso,
   ma non offre ancora l'apertura navigabile di quella copia come sessione separata.
2. Non esiste una campagna ripetuta sui backend reali con 100.000 movimenti: il benchmark
   presente usa il repository in-memory e non misura IndexedDB/OPFS, rendering o memoria di
   Chromium.
3. Mancano prove ripetute per Web Locks/migrazioni concorrenti, cinque schede, chiusure
   durante scrittura, quota insufficiente e aggiornamento Service Worker.
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
