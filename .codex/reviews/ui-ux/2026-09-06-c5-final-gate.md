# 12.5.C5-F — Final cross-surface consistency gate

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.C5-F
Schermata: Final cross-surface consistency gate
Route: `#overview`, `#transactions`, `#accounts`, `#budgets`, `#recurring`, `#loans`, `#investments`, `#analytics`, `#imports`, `#backup`, `#categories`, `#tags`, `#profile`, `#settings`, `#notifications`, `#privacy-security`
Data: 2026-09-06
Reviewer/fase: Codex — independent final gate, 12.5.C5-F
Flusso principale: evidence C5 → matrice → campione indipendente → browser gate → real-flow gate → quality gates
Modifiche: aggiornati esclusivamente state, evidence, roadmap, changelog, manifest e review del gate; nessuna modifica runtime.
Esito: PASS
Framework: `docs/ux/C5_CROSS_SURFACE_CONSISTENCY_FRAMEWORK.md`
Branch: `codex/phase-12-5-0-checkpoint`
Risultato: `C5_FINAL_GATE_PASS`; 12.5.C5 COMPLETE; prossimo `12.5.D` (non avviato)

## Evidence e decisione

- Letti state, matrici C3/C4/C5, review C5.0–C5.5, framework C5, PRIMARY_FLOWS, integrazione
  mockup Stitch e design system `packages/ui`.
- Ogni rilievo C5 è `CLOSED` o `ACCEPTED`; non esistono `OPEN`, `PARTIAL` o `DEFERRED`.
  ACCEPTED ha motivazione esplicita; P0/P1/P2 aperti: `0/0/0`.
- Il campione indipendente conferma navigazione, chrome, terminologia, CTA, form, feedback,
  FinancialAmount, KPI, responsive, accessibilità, security sanity e performance sanity.
- C3 e C4 restano congelate; nessuna nuova feature o variazione di comportamento dominio.

## Browser gate

- Browser reale: Dashboard, Movimenti, Conti, Budget, Ricorrenze/Allocazioni, Prestiti,
  Investimenti, Analisi, Importazione, Backup, Categorie, Tag, Profilo, Impostazioni e Notifiche;
  shell, route attiva, H1, landmark, nomi accessibili e console verificati.
- Viewport configurati: 320, 375, 390, 768, 1024 e 1440 px; reflow e overflow critico assenti.
- Zoom browser 200%: shell, Dashboard e Conti verificati; test 200% verdi e contenuti/CTA utilizzabili.
- E2E finale shell/dashboard/accounts: `25 passed`, `17 skipped`, `0 failed`.

## Functional and accessibility gate

- Real-flow E2E: movimento, trasferimento, conto, budget/analisi, prestito/investimento, import,
  backup/restore e ricorrenze/allocazioni: `11 passed`, `9 skipped`, `0 failed` a 390 px.
- Form, dialog, bottom sheet, toast, loading, empty/error/offline/success/retry, focus, Escape,
  focus return, headings, labels e keyboard restano coperti dalle evidence C3/C4/C5.
- Touch target minimo 44 px; reduced motion, contrasto e reflow senza finding bloccante.
- Financial presentation: `it-IT`, minor units, segni, entrate/uscite, trasferimenti neutrali,
  saldi, budget, percentuali, prestiti, investimenti, KPI e progress invariati.

## Security and performance gate

- Security sanity: nessun secret, dato finanziario reale in fixture/log, unsafe HTML, formula
  injection, permission ampliato, dipendenza nuova o errore tecnico sensibile introdotto da C5.
- Performance sanity: nessun degrado evidente di rendering, liste, navigazione, listener, memoria
  o layout shift. Il warning Vite sui chunk >500 kB è preesistente, non bloccante e documentato.

## Test gate

- `pnpm verify`: PASS — format, lint, typecheck completo, Vitest `140 passed | 1 skipped` /
  `633 passed | 4 skipped`, build PWA verde.
- `pnpm exec playwright test test/e2e/c3-shell-audit.spec.ts test/e2e/c3-dashboard-audit.spec.ts test/e2e/c3-accounts-audit.spec.ts --workers=1`: PASS — `25 passed`, `17 skipped`, `0 failed`.
- Smoke/real-flow C5.5: PASS — `11 passed`, `9 skipped`, `0 failed`.
- `pnpm manifest:check`: PASS.
- `pnpm codex:validate`: PASS — 17 route.
- `pnpm format:check`: PASS.
- `pnpm test:ui-ux`: PASS — 4 test.
- `pnpm quality:ui-ux`: PASS — checklist standard valida.
- `git diff --check`: PASS.

## Checklist standard

| Area | ID | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | U-F | PASS | tutte le superfici e route riconciliate |
| Mobile | M-F | PASS | 320/390 px, nav, reflow e touch |
| Desktop | D-F | PASS | 1024/1440 px, sidebar e chrome |
| Tablet | T-F | PASS | 768 px e contenuti essenziali |
| Visuale | V-F | PASS | token, spacing, radius e typography |
| Ricerca | R-F | PASS | global search e route |
| Form | F-F | PASS | label, validation, busy e submit |
| Feedback | FB-F | PASS | stati, dialog, retry e toast |
| Accessibilità | A-F | PASS | keyboard, focus, names, zoom e ARIA |
| Finanza | FN-F | PASS | importi, segni, KPI e invarianti |
| Performance | P-F | PASS | build, listener e layout sanity |

P0 aperti: Nessuno

## Esito finale

`C5_FINAL_GATE_PASS` — 12.5.C5 è chiusa e pronta per la review indipendente `12.5.D`.
D non è stata avviata.
