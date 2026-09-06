# 12.5.C5.3 — Componenti finanziari e rappresentazione dati

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.C5.3
Schermata: Dati finanziari cross-surface
Route: `#overview`, `#transactions`, `#accounts`, `#budgets`, `#loans`, `#investments`, `#analytics`, `#imports`
Data: 2026-09-06
Reviewer/fase: Codex — UI/UX + QA, 12.5.C5.3
Flusso principale: audit formatter e KPI → confronto Dashboard/Movimenti/Analisi → consolidamento minimo → test finanziari → E2E responsive → gate completo
Modifiche: rimosso il formatter monetario locale Dashboard che convertiva `bigint` in `Number`; aggiunto `formatPercentage` condiviso in `packages/ui`; allineate percentuali/progress di Dashboard, Analisi, Budget, Prestiti e Investimenti; rimosso wrapper duplicato Import.
Esito: PASS
Framework: `docs/ux/C5_CROSS_SURFACE_CONSISTENCY_FRAMEWORK.md`
Branch: `codex/phase-12-5-0-checkpoint`
Risultato: `12.5.C5.3 COMPLETE`; prossimo `12.5.C5.4`

## Audit e decisioni

- `C5-301 CLOSED`: tutti gli importi visualizzati continuano a passare da `FinancialAmount` o
  `formatMinorUnits`; il trend Dashboard ora preserva valuta e precisione della valuta senza
  conversioni numeriche lossy.
- `C5-302 CLOSED`: `formatPercentage` centralizza locale `it-IT`, separatore decimale e simbolo;
  la precisione resta esplicita: progress intero, KPI/trend una cifra, rendimento fino a due.
- `C5-303 CLOSED`: Importazione usa direttamente `formatMinorUnits`; nessun formatter equivalente
  duplicato è stato introdotto.
- Trasferimenti restano neutrali nei KPI e nei totali; entrate/uscite mantengono segni, tone e
  `showPositiveSign`; formule Dashboard/Analisi/Budget/Prestiti/Investimenti non sono state cambiate.
- Nessun componente dominio, persistenza, command layer, minor unit, fonte mercato o calcolo nuovo.

## Formatter e componenti

- Consolidati: `FinancialAmount`, `formatMinorUnits`, nuovo `formatPercentage` esportato da
  `packages/ui`.
- Non è stato creato un nuovo MetricCard: il componente esistente resta il pattern per KPI monetari.
- `formatEditableAmountMinor` resta separato intenzionalmente perché produce input senza simbolo
  valuta; date e backup timestamp restano fuori dal perimetro monetario.

## Browser evidence

- Browser locale reale: Dashboard, Movimenti, Conti, Budget, Prestiti, Investimenti e Analisi
  raggiunti su `#overview`–`#analytics` a 390 px; H1 corretti, nessun overflow, console senza errori.
- E2E finanziari sui viewport 320/375/390/768/1024/1440: `63 passed`, `15 skipped`, `0 failed`.
- Test zoom desktop 200% già presenti per Dashboard/Budget/Categorie/Tag e regressioni finanziarie;
  nessun testo numerico troncato o unità mancante rilevato nei percorsi verdi.

## Test e gate

- Test mirati: 8 file, `37 passed`, `0 failed`, inclusi `FinancialAmount`, `formatPercentage`,
  Dashboard, Analisi, Budget, Prestiti, Investimenti, Import e Movimenti.
- `pnpm verify`: format, lint, typecheck (9 progetti), unit `140 passed | 1 skipped`, `633 passed |
  4 skipped`, build verde; solo warning Vite noto sui chunk >500 kB.
- `pnpm manifest:check`, `pnpm codex:validate`, `pnpm format:check`, `pnpm test:ui-ux`,
  `pnpm quality:ui-ux` e `git diff --check` verdi.

| Area | ID | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | U-03 | PASS | C5-301…C5-303 chiusi nella matrice. |
| Mobile | M-03 | PASS | Dati e KPI leggibili a 320/375/390/768 senza overflow. |
| Desktop | D-03 | PASS | Dashboard, Analisi, budget, prestiti e investimenti verificati a 1024/1440. |
| Tablet | T-03 | PASS | E2E verde a 768. |
| Visuale | V-03 | PASS | Importi e percentuali allineati ai pattern esistenti. |
| Ricerca | R-03 | N/A | Nessun risultato di ricerca o filtro è stato modificato. |
| Form | F-03 | N/A | Nessun form o input finanziario modificato in C5.3. |
| Feedback | FB-03 | PASS | Empty/error/loading e feedback precedenti preservati. |
| Accessibilità | A-03 | PASS | Testi percentuali espliciti, tone e segni non affidati solo al colore. |
| Finanza | FN-03 | PASS | Minor units, valute, trasferimenti neutrali e formule invariati. |
| Performance | P-03 | PASS | Un helper condiviso, nessuna nuova dipendenza; build verde. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno

## Stato finale

`12.5.C5.3 COMPLETE`. Nessuna nuova feature introdotta. La prossima attività è
`12.5.C5.4` — Responsive cross-surface consistency; non avviata.
