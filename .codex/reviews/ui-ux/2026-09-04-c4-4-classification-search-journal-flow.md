# 12.5.C4.4-R — Classification, global search and journal audit

Framework: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`  
Template: `.codex/templates/c3-screen-audit.md`  
Manifest: nexora-ui-ux-mobile-desktop/v1  
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`  
Surface: Categories, Tags, Transactions, Global Search, Journal  
Schermata: Classification and journal complete flow  
Route: `#categories`, `#tags`, `#transactions`, `#journal`, `#overview`  
Routes: `categories`, `tags`, `transactions`, `journal`, `overview`  
Task/Fase: 12.5.C4.4-R  
Branch: `codex/phase-12-5-0-checkpoint`  
Data: 2026-09-04  
Reviewer/fase: Codex — UI/UX + QA, 12.5.C4.4-R  
Modifiche: classificazione gerarchica, tag nel dettaglio, ricerca globale e diario; test E2E e adapter validation.  
Result: `SCREEN_AUDIT_PASS`  
Esito: UI_REVIEW_PASS  
Flusso principale: categoria/tag → movimento classificato → ricerca → diario → merge/archiviazione → reopen  
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom sui desktop; keyboard; touch >=44 px

## Scope e componenti

Verificati `CategoriesPage`, `TagsPage`, `TransactionsPage`, transaction detail, global search,
`JournalPage`, hash routing, persistence, merge, archive/reactivate, cancel and double-submit paths.

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Flusso completo verificato con route, feedback e no overflow. |
| Mobile | M-01 | PASS | E2E chromium-390, touch targets e dialog di ricerca verificati. |
| Desktop | D-01 | PASS | E2E chromium-1440 e zoom reale verificati. |
| Tablet | T-01 | PASS | Layout responsive coperto dalla suite full E2E. |
| Visuale | V-01 | PASS | Coerenza con App Shell e superfici ufficiali verificata. |
| Ricerca | R-01 | PASS | Descrizione, controparte, categoria, tag, conto, clear ed Escape. |
| Form | F-01 | PASS | Movimento/diario, annulla, invalidi e double-submit. |
| Feedback | FB-01 | PASS | Successo, errore, empty state e stato offline verificati. |
| Accessibilità | A-01 | PASS | Axe, focus e keyboard passano nel flusso. |
| Finanza | FN-01 | PASS | `1000 - 80 = 920`, netto `-80`, refs merge preservate. |
| Performance | P-01 | PASS | Full E2E e scenario IndexedDB offline completati. |

## Viewport

| Viewport | Esito | Evidence |
| ---: | --- | --- |
| 390 px | PASS | `test/e2e/c4-classification-search-journal-flow.spec.ts`, mobile flow and negatives |
| 1440 px | PASS | Same E2E, desktop flow and IndexedDB offline |
| Zoom 200% | PASS | CDP real zoom path in the desktop flow |

## Mobile

PASS. Category/tag actions, transaction form, detail, search dialog, journal form and feedback remain
usable at 390px with touch targets, no overflow and correct focus/route behavior.

## Desktop

PASS. Category hierarchy, tag table, transaction detail, global search results and journal summary
remain readable and actionable at 1440px and real 200% zoom.

## Funzionalità e navigazione

PASS: source/target category and tag merges preserve references; archived targets can reactivate;
global search covers description, payee, category, tags and account with mouse/touch/Enter paths,
no-results, clear and Escape; journal edit is idempotent; reload/reopen and offline IndexedDB paths pass.

## Accessibilità

PASS. Axe, overflow, focus, keyboard and runtime-error checks pass in the complete flow.

La matrice completa ha prodotto 8 passaggi sui sei profili (3 test principali/negativi sui profili
dedicati e il test IndexedDB sul desktop); il percorso offline a 1440 px usa IndexedDB, service
worker attivo, reload offline e verifica finale online senza duplicati. Il saldo resta `920,00 EUR`,
la spesa `80,00 EUR`, il netto `-80,00 EUR`; il diario espone entrate `0,00`, spese `80,00`,
risparmio `-80,00` e valutazioni investimento `0,00`.

## Rilievi iniziali e correzioni

### P0

Nessuno.

### P1

Nessuno.

### P2

Nessuno.

P0 aperti: Nessuno  
P1/P2 aperti: Nessuno  
Esito: PASS
