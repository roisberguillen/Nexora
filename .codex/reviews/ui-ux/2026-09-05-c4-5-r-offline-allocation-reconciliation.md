# 12.5.C4.5-R — Offline allocation reconciliation audit

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`
Surface: Transactions, Allocations, Accounts, Budgets, Recurring, Notifications
Schermata: Offline salary allocation complete flow
Route: `#transactions`, `#accounts`, `#budgets`, `#recurring`, `#notifications`
Routes: `transactions`, `accounts`, `budgets`, `recurring`, `notifications`
Task/Fase: 12.5.C4.5-R
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-09-05
Reviewer/fase: Codex — UI/UX + QA, 12.5.C4.5-R
Modifiche: chiusura del percorso stipendio e allocazioni offline; refresh derivato non blocca il comando locale.
Result: `FLOW_AUDIT_PASS`
Esito: PASS
Flusso principale: preparazione online → service worker → stipendio offline → allocazioni → reload offline → reconnessione
Viewport applicabili: 1440 px offline; regressione C4.5 sui profili 320, 375, 390, 768, 1024, 1440 px

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Stipendio e due allocazioni completati senza rete. |
| Mobile | M-01 | PASS | Flusso C4.5 principale passato su 320/375/390 px. |
| Desktop | D-01 | PASS | Flusso principale e offline passati a 1440 px. |
| Tablet | T-01 | PASS | Flusso principale passato a 768 px. |
| Visuale | V-01 | PASS | Nessuna variazione di colori o font approvati. |
| Ricerca | R-01 | PASS | Notifiche stipendio e budget verificate nella route dedicata. |
| Form | F-01 | PASS | Dialog stipendio utilizzabile offline con CTA esplicite. |
| Feedback | FB-01 | PASS | Successo allocazioni, banner offline e reload verificati. |
| Accessibilità | A-01 | PASS | Nomi dialog e controlli del percorso passati; axe nel flusso principale. |
| Finanza | FN-01 | PASS | 2870/270/110, patrimonio 3250, budget 400/500, due trasferimenti. |
| Performance | P-01 | PASS | Il comando locale non attende il refresh derivato offline. |

## Evidenza offline

Con IndexedDB selezionato prima del bootstrap e service worker pronto, la rete è stata disabilitata
dopo la preparazione UI. Sono stati registrati 2500 EUR, confermate due allocazioni, escluso il
piano sospeso da 40 EUR, ricaricata la PWA offline e verificata la riconnessione senza nuovi record.
La lista mostra quattro righe: spesa, stipendio e due trasferimenti; i quattro leg sono verificati
dal modello di dominio e dai test di `executeConfirmedAllocationPlans`.

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS
