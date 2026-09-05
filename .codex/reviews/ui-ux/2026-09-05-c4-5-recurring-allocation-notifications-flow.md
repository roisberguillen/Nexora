# 12.5.C4.5 — Recurring allocation and notification flow audit

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`  
Template: `.codex/templates/c3-screen-audit.md`  
Manifest: nexora-ui-ux-mobile-desktop/v1  
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`  
Surface: Recurring, Allocations, Transactions, Budgets, Notifications  
Schermata: C4.5 recurring allocation notification complete flow  
Route: `#recurring`, `#transactions`, `#budgets`, `#notifications`, `#accounts`  
Routes: `recurring`, `transactions`, `budgets`, `notifications`, `accounts`  
Task/Fase: 12.5.C4.5  
Branch: `codex/phase-12-5-0-checkpoint`  
Data: 2026-09-05  
Reviewer/fase: Codex — UI/UX + QA, 12.5.C4.5  
Modifiche: data contabile salary riusata nelle allocazioni manuali; E2E deterministico, offline/reload e date weekend.  
Result: `FLOW_AUDIT_PASS`  
Esito: PASS  
Flusso principale: ricorrenza stipendio → entrata → Non ora → allocazioni → trasferimenti → budget/notifiche → reload/offline  
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom sui desktop; keyboard; touch >=44 px

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Flusso UI completo passato su tutti i sei profili configurati. |
| Mobile | M-01 | PASS | Chromium 320/375/390: form, dialog e feedback senza overflow. |
| Desktop | D-01 | PASS | Chromium 1024/1440: flusso e CDP real zoom 200% passati. |
| Tablet | T-01 | PASS | Chromium 768: flusso completo e layout responsive passati. |
| Visuale | V-01 | PASS | Superfici coerenti con App Shell e mockup ufficiale; nessuna modifica colori/font. |
| Ricerca | R-01 | PASS | Notifiche stipendio/budget individuate e deep-link route verificata. |
| Form | F-01 | PASS | Conti, categoria, budget, ricorrenza, piani e movimento creati dalla UI. |
| Feedback | FB-01 | PASS | `Non ora`, successo, errore/retry dominio e stato offline verificati. |
| Accessibilità | A-01 | PASS | Axe, dialog, tastiera, focus e nomi accessibili verificati. |
| Finanza | FN-01 | PASS | 600/100/50 → 3100/3250 → 2870/270/110; budget 400/500 invariato. |
| Performance | P-01 | PASS | E2E completo e gate verify completati senza failure. |

## Gate e rilievi

P0 aperti: Nessuno  
P1/P2 aperti: Nessuno  
Esito: PASS

La suite E2E completa ha prodotto 401 pass, 181 skip motivati e 0 failure su 582 casi. Il nuovo
scenario C4.5 ha prodotto 7 pass e 5 skip motivati; il percorso offline/reload è passato a 1440.
I test dominio mantengono la copertura di doppio comando, errore parziale, retry con lo stesso
`executionId`, due gambe e target invalido.
