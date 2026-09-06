# 12.5.C4-F — Regressione completa e chiusura della C4

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.C4-F
Schermata: Regressione completa C4.0–C4.10
Route: `bootstrap`, `#dashboard`, `#accounts`, `#transactions`, `#categories`, `#tags`, `#recurring`, `#budgets`, `#imports`, `#backup`, `#privacy-security`, `#settings`, `#loans`, `#investments`, `#analytics`, `#journal`
Data: 2026-09-06
Reviewer/fase: Codex — Security + UI/UX + QA, 12.5.C4-F
Flusso principale: fixture sintetiche isolate → flussi C4.1–C4.10 → reload/reopen/offline → negativi → riconciliazione finale
Modifiche: sola chiusura documentale della regressione; nessuna nuova funzionalità di prodotto.
Esito: PASS
Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Branch: `codex/phase-12-5-0-checkpoint`
Risultato: `C4_FINAL_GATE_PASS`

## Matrice di regressione

| Fase | Flusso verificato | Test/report | Esito |
| --- | --- | --- | --- |
| C4.0 | Framework e matrice | framework + matrix | PASS |
| C4.1 | Primo avvio, profilo, primo conto, riapertura/offline | `c4-first-start-account-flow.spec.ts` | PASS |
| C4.2 | Entrate, spese, modifica, annulla, Dashboard/Analisi | `c4-income-expense-flow.spec.ts` | PASS |
| C4.3 | Trasferimento a due gambe, annulla, invarianti | `c4-transfer-flow.spec.ts` | PASS |
| C4.4 | Categorie, tag, ricerca globale, diario, merge | `c4-classification-search-journal-flow.spec.ts` | PASS |
| C4.5 | Ricorrenze, stipendio, allocazioni, budget, notifiche | `c4-recurring-allocation-notifications-flow.spec.ts` | PASS |
| C4.6 | Prestiti, investimenti, Dashboard, Analisi | `c4-loans-investments-dashboard-analytics-flow.spec.ts` | PASS |
| C4.7 | Money Manager XLSX, mapping, import, reimport, undo | `c4-money-manager-xlsx-migration-flow.spec.ts` | PASS |
| C4.8 | Estratto conto CSV, mapping, export, undo | `c4-bank-statement-import-export-flow.spec.ts` | PASS |
| C4.9 | Backup, verifica, restore, rollback, Drive opzionale | `c4-backup-restore-drive-flow.spec.ts` | PASS |
| C4.10 | App Lock, preferenze, cestino, reset, recovery | `c4-app-lock-settings-recovery-flow.spec.ts` | PASS |

Le fixture sono sintetiche e deterministiche, con importi in minor units e trasferimenti esclusi
da entrate/spese. La suite attraversa i flussi completi per superficie in contesti isolati, così
un reset, un undo o un restore non possono contaminare il flusso successivo.

## Ambiente, responsive e gate

- Chromium Playwright: `320×800`, `375×812`, `390×844`, `768×1024`, `1024×900`, `1440×1000`.
- CDP zoom reale 200% sui profili desktop `1024` e `1440`; overflow, axe, focus e target touch
  sono inclusi nei test dedicati. Offline/reload/reopen coperti su IndexedDB, OPFS/PWA e startup.
- Primo full run: `666` test, `433 passed`, `233 skipped`, `0 failed`.
- Secondo full run isolato: `pnpm exec playwright test --workers=1`; `666` test, `433 passed`,
  `233 skipped`, `0 failed` in `23.4m`.
- Gli `233 skipped` sono skip condizionali preesistenti per viewport/backend dichiarati nei test;
  nessun nuovo skip è stato introdotto. Un run concorrente diagnostico ha mostrato contesa del
  server/browser condiviso; i casi C4 coinvolti passano isolati e non indicano failure applicative.
- Gate repository: format, lint, typecheck, Vitest, build, manifest, orchestrator, UI/UX review,
  audit produzione e test offline/recovery verdi; benchmark IndexedDB/OPFS 100.000 record verdi.

| Area | ID | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Tutte le righe C4.0–C4.10 riconciliate nella matrice. |
| Mobile | M-01 | PASS | Profili 320/375/390 e flussi C4 dedicati senza overflow. |
| Desktop | D-01 | PASS | Profili 1024/1440, zoom CDP e restore/offline verificati. |
| Tablet | T-01 | PASS | Profilo 768 e regressioni responsive verdi. |
| Visuale | V-01 | PASS | Report dedicati coerenti con il mockup ufficiale. |
| Ricerca | R-01 | PASS | Ricerca globale, filtri e risultati senza regressioni. |
| Form | F-01 | PASS | Validazioni, annulla, doppio submit e conferme verificati. |
| Feedback | FB-01 | PASS | Errori, loading, vuoti, successo e recovery osservabili. |
| Accessibilità | A-01 | PASS | Axe, focus, tastiera, dialog e target verificati. |
| Finanza | FN-01 | PASS | Saldi, minor units, trasferimenti neutrali e rollback riconciliati. |
| Performance | P-01 | PASS | Full suite e benchmark 100.000 record senza failure. |

P0 aperti: Nessuno  
P1 aperti: Nessuno  
P2 aperti: Nessuno

## Stato finale

`12.5.C4-F COMPLETE` — `C4_FINAL_GATE_PASS`. C4.0–C4.10 sono chiuse con evidence rintracciabile;
la prossima attività è `12.5.C5 — Coerenza tra schermate e percorsi trasversali`.
