# Roadmap di implementazione

## Milestone 0 — Fondazioni ✅
Monorepo, TypeScript strict, lint, test, CI, PWA shell, design tokens, error boundary, logging sicuro, ADR.

Completata il 2026-07-27. Verificata con unit test, build PWA, controllo accessibilità,
viewport 320/768/1440 e ricaricamento offline.

## Milestone 1 — Dominio contabile ✅
Money, Account, Transaction, Transfer, Category, repository in-memory e test invarianti.

Completata il 2026-07-27. Include report income/expense senza trasferimenti, saldi
ricostruibili e commit logico atomico delle due gambe nel repository in-memory.

## Milestone 2 — Persistenza offline ✅
SQLite/OPFS adapter, fallback IndexedDB, migrazioni, seed demo, backup locale basilare.

Avanzamento:

- [x] Schema SQLite v1 per conti, categorie, transazioni e trasferimenti.
- [x] Migrazione iniziale reversibile e testata su SQLite.
- [x] Runner atomico e blocco preventivo per migrazioni senza backup verificato.
- [x] Adapter SQLite/OPFS in worker con riapertura browser verificata.
- [x] Adapter fallback IndexedDB e selettore OPFS→IndexedDB fail-safe.
- [x] Seed dimostrativo sintetico, idempotente e verificato sui due adapter.
- [x] Provider fisico SQLite/OPFS cifrato e ripristino locale verificato.
- [x] Integrazione con la PWA e verifica offline.

Completata il 2026-07-27. La PWA mantiene stabile il backend scelto, non inserisce dati
automaticamente e riapre ledger OPFS e IndexedDB con rete indisponibile.

## Milestone 3 — UI core ✅
Dashboard base, conti, transazioni, categorie, tag, ricerca e responsive layout.

Avanzamento:

- [x] Dashboard di sola lettura collegata al ledger persistente.
- [x] Metriche esatte per patrimonio EUR, entrate, spese e saldo dei flussi.
- [x] Riepilogo conti e movimenti recenti responsive, con trasferimenti collassati.
- [x] Componenti `FinancialAmount` e `MetricCard` riutilizzabili.
- [x] Gestione conti con creazione, modifica conservativa, archiviazione e riattivazione.
- [x] Gestione movimenti, split e rettifiche.
  - [x] Registrazioni manuali di entrate, spese e rettifiche, trasferimenti atomici e
    annullamento conservativo.
  - [x] Split con raggruppamento persistente e migrazione dedicata.
  - [x] Modello e migrazione v2 per split persistenti, con UI e controlli E2E iniziali.
- [x] Gestione categorie e tag, inclusa l'assegnazione atomica dei tag ai movimenti.
- [x] Ricerca globale offline per conti, categorie, tag e movimenti.

Completata il 2026-07-28. Verificata con unit/integration test, flussi E2E responsive
320/768/1440, audit Axe, persistenza locale e baseline visuali aggiornate.

## Milestone 4 — Money Manager XLSX
Parser, mapping wizard, preview, validazione, deduplica, dry-run, import atomico, undo batch, report.

Avanzamento:

- [x] Lettura locale e immutabile dei workbook XLSX con selezione dei fogli disponibili.
- [x] Rilevamento iniziale delle intestazioni Money Manager e anteprima delle righe.
- [x] Normalizzazione conservativa di date e importi in minor units, con righe ambigue
  indirizzate alla revisione anziché importate.
- [x] Schermata responsive per caricamento locale, scelta del foglio e correzione del mapping.
- [x] Dry-run conservativo con risoluzione di conto/categoria, validazione della valuta e
  righe ambigue mantenute fuori dal commit.
- [x] Deduplica locale e persistente tramite fingerprint SHA-256 per conto e riga sorgente.
- [x] Commit atomico del batch, delle righe auditabili e delle transazioni su SQLite/OPFS e
  IndexedDB, con migrazione additiva v4.
- [x] Storico locale dei batch e annullamento conservativo: le transazioni importate sono
  annullate, mentre batch e righe restano auditabili.
- [x] Test unitari, adapter, riapertura IndexedDB e flusso E2E completo su 320/768/1440 px.

Completata il 2026-07-28. L’importatore Money Manager legge esclusivamente file locali,
richiede una conferma esplicita per il commit e conserva un audit persistente dei batch,
delle righe duplicate e delle righe da revisionare.

## Milestone 5 — Ricorrenze e allocazioni ✅

- [x] Regole mensili persistenti per entrate e spese, con data nominale e policy italiana
  per lo stipendio se il 28 cade nel fine settimana.
- [x] Piani di allocazione persistenti a importo fisso per stipendio e reddito fotografico,
  fra conti attivi della stessa valuta.
- [x] Rilevamento conservativo dello stipendio contabilizzato atteso e proposta esplicita
  di esecuzione; nessun trasferimento è creato senza un secondo consenso.
- [x] UI responsive per configurare, annullare o confermare le proposte a 320/768/1440 px.

Completata il 2026-07-28. Le allocazioni sono configurabili: gli importi €170 e €60
restano esempi da impostare sui conti effettivi dell'utente e non vengono precompilati.

## Milestone 6 — Budget, prestiti e investimenti ✅

- [x] Budget mensili globali o per categoria, con soglie 80%/100% calcolate dalle sole
  spese contabilizzate.
- [x] Prestiti persistenti con rata, capitale residuo/originario, scadenza e progresso.
- [x] Posizioni di investimento manuali con capitale, valore corrente e rendimento.
- [x] Dashboard con debito residuo e valore/rendimento degli investimenti separati dai flussi.

Completata il 2026-07-28. Migrazioni additive v7-v9 e upgrade IndexedDB equivalenti
conservano tutti i record esistenti.

## Milestone 7 — Importatori bancari
Mediobanca XLSX, N26 PDF, riconoscimento trasferimenti e revisione.

Avanzamento:

- [x] Anteprima locale per Mediobanca XLSX e N26 PDF, separata dal parser Money Manager.
- [x] Batch auditabili con tipo di importatore persistente e migrazione additiva v10.
- [x] Possibili trasferimenti verso conti locali trattenuti per revisione manuale.
- [x] Revisione riga per riga e conferma esplicita dei trasferimenti riconosciuti, con
  commit e undo atomici delle due gambe su tutti gli adapter.

Completata il 2026-07-28. Gli estratti restano locali; i trasferimenti fra conti propri
non sono mai classificati come entrate o spese e richiedono una conferma per riga.

## Milestone 8 — Backup ed export
CSV/XLSX/JSON, backup NAS e Google Drive, cifratura, checksum, restore test.

Avanzamento:

- [x] Export locale CSV dei movimenti e JSON del ledger, con precisione minor units e
  protezione da formula injection.
- [x] Filtri export per intervallo, conto e categoria.
- [x] Export XLSX locale rileggibile, costruito dalle stesse righe canoniche del CSV.
- [ ] Backup configurabile, destinazioni NAS/Google Drive, cifratura e restore verificato.

## Milestone 9 — Analisi e diario
Widget, trend, forecast conservativi, diario mensile.

## Milestone 10 — Hardening e release
Accessibilità, performance 100k record, threat review, recovery drill, packaging PWA.

Ogni milestone deve produrre una demo verticale e soddisfare `docs/testing/QUALITY_GATES.md`.
