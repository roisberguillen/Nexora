# 12.5.C4.5-R2 — Local refresh gate audit

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`
Surface: Transactions, Allocations, Accounts, Budgets, Recurring, Notifications
Schermata: Offline salary allocation local refresh
Route: `#transactions`, `#accounts`, `#budgets`, `#recurring`, `#notifications`
Routes: `transactions`, `accounts`, `budgets`, `recurring`, `notifications`
Task/Fase: 12.5.C4.5-R2
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-09-05
Reviewer/fase: Codex — UI/UX + QA, 12.5.C4.5-R2
Modifiche: refresh immediato dei modelli dal ledger locale dopo le allocazioni offline.
Result: `FLOW_AUDIT_PASS`
Esito: PASS
Flusso principale: preparazione UI → service worker → stipendio offline → allocazioni → verifica senza reload → reload → reconnessione
Viewport applicabili: 1440 px offline; regressione C4.5 su 320, 375, 390, 768, 1024, 1440 px

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Snapshot UI ricostruito dal repository dopo la scrittura. |
| Mobile | M-01 | PASS | Flusso C4.5 passato su 320/375/390 px. |
| Desktop | D-01 | PASS | Flusso offline e refresh immediato passati a 1440 px. |
| Tablet | T-01 | PASS | Flusso C4.5 passato a 768 px. |
| Visuale | V-01 | PASS | Colori, font e gerarchia approvati invariati. |
| Ricerca | R-01 | PASS | Route Notifiche e stato derivato aggiornati senza reload. |
| Form | F-01 | PASS | Dialog stipendio e CTA di allocazione completano il percorso offline. |
| Feedback | FB-01 | PASS | Successo, banner offline e stato aggiornato verificati. |
| Accessibilità | A-01 | PASS | Axe, tastiera, focus e controlli principali verificati dalla suite C4.5. |
| Finanza | FN-01 | PASS | Saldi `2870/270/110`, patrimonio `3250`, budget `400/500`, due trasferimenti / quattro leg. |
| Performance | P-01 | PASS | Refresh locale immediato senza reload o rete. |

## Evidenza e riconciliazione

Sul backend IndexedDB, dopo la conferma offline di stipendio `2500,00 EUR`, la UI ha mostrato
immediatamente i saldi `2870/270/110`, patrimonio `3250,00 EUR`, budget `400/500`, due trasferimenti,
piano sospeso da `40,00 EUR` escluso, notifica stipendio assente e notifica budget all’80% presente.
La stessa verifica è passata dopo reload offline e dopo riconnessione; la lista finale contiene una
spesa, uno stipendio e due trasferimenti senza duplicati.

La causa era `refresh: false` in `mutateLedger`, introdotto per evitare il blocco del refresh derivato.
La correzione ripristina il refresh standard dopo ogni mutazione, rilegge `loadAppModels` dal repository
locale e usa un aggiornamento funzionale dello stato React. Nessuna logica finanziaria è duplicata nel
frontend e l’idempotenza `executionId` resta nel dominio.

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS
