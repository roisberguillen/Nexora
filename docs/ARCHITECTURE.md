# Architettura tecnica

## Stile
Modular monolith TypeScript in monorepo, con confini di dominio chiari e possibilità di estrarre servizi solo in futuro.

## Stack di destinazione
- Frontend: React + TypeScript + Vite.
- PWA browser: Workbox/Vite PWA plugin, opzionale e separata.
- Desktop Windows/macOS e Android: Tauri 2.
- UI: componenti accessibili, design tokens, CSS modulare o Tailwind.
- Stato server/local: TanStack Query per orchestrazione; stato UI locale separato.
- Database browser: SQLite WASM con OPFS quando disponibile; fallback IndexedDB tramite adapter.
- Database nativo: SQLite, dietro gli stessi contratti di repository delle feature condivise.
- Validazione: Zod.
- Test: Vitest, Testing Library, Playwright.
- Import XLSX: SheetJS (`xlsx`) isolato nel package importers.
- PDF: parser dedicato e revisione manuale; nessun OCR come percorso primario.
- Backend locale incorporato: Rust; Nexora Local Hub usa Axum, Tokio, Rustls, mDNS/DNS-SD e
  pairing crittografico esplicito per la sola sincronizzazione locale.

## Layer
1. `apps/web`: shell PWA, routing, UI.
2. `packages/domain`: entità, value object, use case, regole contabili.
3. `packages/database`: repository, migrazioni, transazioni atomiche.
4. `packages/importers`: parser, normalizzatori, mapping, deduplica.
5. `packages/ui`: componenti condivisi.
6. `platform`: adapter Tauri, SQLite nativo, secure storage e integrazioni di dispositivo.
7. `infra`: nessun agente NAS, SMB o Docker di backup.

## Regola dipendenze
UI → application/domain → repository interface. Gli adapter infrastrutturali implementano le interfacce; il dominio non importa React, database o librerie XLSX.

## Offline-first
- Tutte le operazioni core sono locali.
- Service worker per app shell e asset.
- Nessuna dipendenza di rete per consultare o modificare dati.
- Coda locale per backup/sync esterni.

SQLite WASM viene eseguito tramite API OO1 in un Web Worker dedicato. La connessione
OPFS implementa la porta asincrona `SqliteDatabase`; migrazioni e
`SqliteLedgerRepository` non dipendono direttamente dal runtime WASM. Development,
preview e hosting devono inviare gli header COOP/COEP necessari a
`SharedArrayBuffer`. L'indisponibilità di OPFS produce un errore tipizzato e non un
fallback volatile implicito.

`IndexedDbLedgerRepository` è il fallback persistente per i contesti privi dei
prerequisiti OPFS. Usa object store separati e transazioni atomiche, ma condivide con
SQLite i codec dei record e la rappresentazione testuale esatta degli importi.
`openBrowserLedger` preferisce OPFS e passa a IndexedDB solo per indisponibilità
esplicita; errori di un ledger OPFS esistente non vengono mascherati aprendo un
archivio alternativo. Al primo bootstrap PWA la scelta completata viene registrata
localmente; le sessioni successive forzano quel backend e falliscono in modo visibile
se non è più disponibile. Una singola promise di apertura evita connessioni duplicate
durante il ciclo di sviluppo di React.

La PWA rende disponibili stati di apertura, pronto ed errore, insieme a backend,
versione schema e soli conteggi aggregati. Il seed dimostrativo resta un'azione
esplicita. Il service worker precache include il runtime WebAssembly e i worker SQLite,
così entrambi i backend possono essere riaperti senza rete dopo l'installazione.

La dashboard usa una proiezione pura nel layer applicativo web. La proiezione riceve le
entità ricostruite dal repository e delega saldi e cash flow ai servizi del dominio;
la UI riceve soltanto metriche, conti e attività già normalizzate. Le due gambe di un
trasferimento diventano una sola riga neutrale, mentre i componenti visuali non
ricalcolano invarianti finanziarie.

La gestione conti segue lo stesso confine: i comandi applicativi costruiscono o
aggiornano l'entità `Account`, mentre `LedgerRepository.updateAccount` applica le
invarianti usando fatti ricavati atomicamente dal backend. Gli adapter in-memory,
SQLite/OPFS e IndexedDB impediscono modifiche retroattive al saldo iniziale dopo il
primo movimento e mantengono coerente l'archiviazione dei sottoconti. La pagina React
riceve una proiezione con saldi, stato e capacità di modifica; non interroga né
ricalcola direttamente le regole del repository.

La gestione movimenti usa comandi applicativi separati per registrazioni manuali e
trasferimenti. Le registrazioni manuali creano entità `Transaction`; un trasferimento
valida conti attivi, distinti e nella stessa valuta, poi persiste le due gambe in un
unico commit. L'annullamento conserva lo storico impostando lo stato `cancelled`;
una gamba di trasferimento non è annullabile individualmente e gli adapter applicano
lo stato alle due gambe in modo atomico. La pagina React riceve una proiezione che
collassa ogni trasferimento in una riga neutrale.

Il backup locale basilare del backend primario esporta i bytes SQLite nel worker,
costruisce un manifest con checksum e cifra l'intero archivio con AES-GCM. Il provider
filesystem rilegge e decifra il file prima di produrre una ricevuta utilizzabile dal
runner delle migrazioni. Il restore viene validato in un database temporaneo e conserva
una copia di rollback prima di sostituire OPFS.

## Sicurezza
- CSP restrittiva.
- Segreti mai inclusi nel bundle.
- Token OAuth custoditi nel servizio locale quando utilizzato.
- Backup cifrati lato client o prima della trasmissione.

## Direzione multipiattaforma

Le feature React condividono dominio, query e command. La PWA conserva gli adapter browser;
Tauri 2 usa SQLite nativo e secure storage. Nessun file SQLite aperto viene condiviso in rete:
il Local Hub sincronizza esclusivamente operation log incrementali dopo pairing esplicito.
Google Drive e il file `.nexora` manuale sono le sole destinazioni di backup; il Local Hub non è
un servizio di backup.
