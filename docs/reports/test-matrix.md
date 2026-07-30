# Matrice test — stato al 2026-07-30

| Area | Evidenza | Esito |
|---|---|---|
| Formattazione, lint, typecheck, unit, build | `pnpm verify` | Verde: 295 passati, 4 skip |
| E2E startup | `startup-orchestrator.spec.ts` | Verde: 1 pass, 4 skip per progetto |
| E2E reload ripetuto | `startup-reload-resilience.spec.ts` | Verde: 50 reload consecutivi su Chromium 1440 |
| E2E avvio multi-tab | `startup-multitab.spec.ts` | Verde: cinque schede Chromium 1440 contemporanee |
| E2E rollback atomico | `atomic-rollback.spec.ts` | Verde: scrittura interrotta, riapertura senza record parziali su IndexedDB e OPFS |
| E2E funzioni principali | conti, movimenti, categorie, tag, dashboard | Verde: 72 passati, 8 skip |
| E2E persistenza/backup/import | IndexedDB, OPFS, PWA, backup, import | Verde: 15 passati, 20 skip |
| E2E funzioni finanziarie/UI shell | budget, ricorrenze, prestiti, investimenti, ricerca, shell | Verde: 29 passati, 6 skip |
| E2E completo | `pnpm test:e2e` | Verde: 120 passati, 50 skip condizionati |
| Browser integrato, mobile e desktop | navigazione reale 320/1440 | Recovery visualizzato; storage non disponibile nel runtime di audit |
| Benchmark 100k IndexedDB reale | Chromium 1440, archivio temporaneo | Verde: inserimento, riapertura e lettura di 100.000 movimenti |
| Benchmark 100k OPFS reale | Chromium 1440, directory temporanea | Verde: inserimento, riapertura e lettura di 100.000 movimenti |
| Resilienza multi-tab/quota/worker | nessuna evidenza completa | Non completato |
| Restore temporaneo navigabile | verifica backup senza mutazione | Non completato |
