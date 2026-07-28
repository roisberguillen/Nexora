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

## Milestone 5 — Ricorrenze e allocazioni
Stipendio giorno 28 con weekend policy, risparmio €170, Directa €60, redditi fotografici e conferme.

## Milestone 6 — Budget, prestiti e investimenti
Soglie, Findomestic/Agos, dashboard debiti, performance investimenti.

## Milestone 7 — Importatori bancari
Mediobanca XLSX, N26 PDF, riconoscimento trasferimenti e revisione.

## Milestone 8 — Backup ed export
CSV/XLSX/JSON, backup NAS e Google Drive, cifratura, checksum, restore test.

## Milestone 9 — Analisi e diario
Widget, trend, forecast conservativi, diario mensile.

## Milestone 10 — Hardening e release
Accessibilità, performance 100k record, threat review, recovery drill, packaging PWA.

Ogni milestone deve produrre una demo verticale e soddisfare `docs/testing/QUALITY_GATES.md`.
