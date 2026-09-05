# 12.5.C4.7 — Migrazione completa Money Manager XLSX

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`
Surface: Import, Accounts, Categories, Transactions, Dashboard, Analytics, Global Search
Schermata: C4.7 complete Money Manager XLSX migration flow
Route: `#imports`, `#accounts`, `#transactions`, `#`, `#analytics`
Routes: `imports`, `accounts`, `transactions`, `overview`, `analytics`
Task/Fase: 12.5.C4.7
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-09-05
Reviewer/fase: Codex — UI/UX + QA, 12.5.C4.7
Modifiche: gate E2E XLSX completo, riconoscimento Directa SIM, nota trasferimenti, responsive file picker e target brand.
Result: `FLOW_AUDIT_PASS`
Esito: PASS
Flusso principale: XLSX → foglio Movimenti → mapping → piano → preview → dry-run → commit → superfici → reload/reopen → reimport → undo
Viewport applicabili: 320, 375, 390, 768, 1024 e 1440 px; CDP 200% su 1024/1440

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Fixture locale in memoria, 6 righe rendicontate, commit/undo/reimport verificati. |
| Mobile | M-01 | PASS | Flusso completo a 320/375/390 px; negativo XLSX a 390; nessun overflow. |
| Desktop | D-01 | PASS | 1024/1440 px e zoom browser reale CDP 200%. |
| Tablet | T-01 | PASS | Percorso completo verificato a 768 px. |
| Visuale | V-01 | PASS | Piano, preview, stato batch e superfici coerenti; snapshot Dashboard aggiornato per target brand 44 px. |
| Ricerca | R-01 | PASS | Provider e Giroconto conservati e ricercabili nei movimenti; nessun dato inviato in rete. |
| Form | F-01 | PASS | Upload locale, selezione foglio, risoluzione account, profilo mapping, doppio submit/annulla. |
| Feedback | FB-01 | PASS | Conteggi preview, batch committed/undone, qualità 100% e zero conferma su reimport. |
| Accessibilità | A-01 | PASS | Axe, tastiera/focus, target ≥44×44 e ordine di focus verificati. |
| Finanza | FN-01 | PASS | Post-commit N26 `3100,00`, Riserva `250,00`, Directa `86,49`, disponibilità `3350,00`; cash-flow `2500/150/2350`. |
| Performance | P-01 | PASS | Reload/reopen, IndexedDB offline e OPFS/PWA reopen verificati; nessun retry. |

## Evidenza e riconciliazione

La fixture `money-manager-c4-7-sintetico.xlsx` contiene i fogli `Informazioni` e `Movimenti`, la
doppia colonna `Conto`, importi assoluti con segno da `Guadagni/Spese`, 5 righe valide e il seriale
Excel 60 in revisione. Il ledger conserva 3 movimenti standard, 1 rettifica e 2 gambe trasferimento;
la UI aggrega le gambe in 5 registrazioni visuali. Audit raw, batch, fingerprint e categorie restano
locali e immutati.

La reimportazione produce 5 duplicate, 1 revisione e conferma disabilitata. Undo annulla tutte le
gambe e gli effetti, conserva batch/audit e lascia gli account creati disponibili; la reimportazione
successiva continua a riconoscere i fingerprint storici. IndexedDB offline passa import/reload/
riapertura; OPFS/PWA passa commit/reload/riapertura.

Difetti corretti: alias reale `Directa SIM` (compatibile anche con `Diretta sim`), nota propagata alle
gambe trasferimento e resa ricercabile, file picker senza overflow a 320 px, brand desktop a 44 px.
P0 aperti: Nessuno  
P1/P2 aperti: Nessuno

Esito: PASS
