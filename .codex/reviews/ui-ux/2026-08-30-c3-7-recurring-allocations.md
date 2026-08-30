# UI/UX screen review — Nexora checklist v2

Manifest: nexora-ui-ux-mobile-desktop/v2
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Ricorrenze e Allocazioni
Route: #recurring
Task/Fase: 12.5.C3.7
Branch: codex/phase-12-5-0-checkpoint
Data: 2026-08-30
Revisore: Codex — UI/QA review
Flusso principale: ingresso → liste vuote → creazione/modifica → conferma → trasferimento/retry
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom; keyboard; touch >=44 px
Code review: PASS
Code review evidence: RecurringPage.tsx, page.css, domain allocation service e test mirati; stati, segni, conti e idempotenza verificati.
Automated browser verification: PASS
Automated browser evidence: pnpm exec playwright test test/e2e/recurring.spec.ts --reporter=line — 6/6 PASS.
Visual browser verification: PASS
Visual browser route/surface: Chrome reale su http://127.0.0.1:5173/#recurring.
Visual browser viewports: 320, 375, 390, 768, 1024, 1440 px; 200% zoom.
Visual browser interactions: apertura route, stato vuoto/editor/header/nav, resize e controllo overflow; flussi popolati coperti da E2E.
Visual browser evidence: a 320 px scrollWidth=320; editor/lista verticali, CTA e bottom navigation disponibili; a 1440 px sidebar, lista e pannelli leggibili.
Visual browser screenshots: N/A motivata — evidenza acquisita nel browser headed e registrata qui.
Esito: UI_REVIEW_PASS

## Universale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Gerarchia | PASS | Titolo, sezioni e form rendono immediato il percorso. |
| U-02 | CTA e terminologia | PASS | CTA, delete, entrata/uscita/trasferimento distinti. |
| U-03 | Flusso reale | PASS | Route, callback, feedback e retry verificati in E2E. |
| U-04 | Logica finanziaria | PASS | Trasferimenti distinti da entrate/spese. |
| U-05 | Robustezza visuale | PASS | Overflow, focus, touch, disabled e doppio submit controllati. |

## Mobile

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px | PASS | Nessun overflow; scrollWidth coincide col viewport. |
| M-02 | 375 px | PASS | Form e spaziatura utilizzabili. |
| M-03 | 390 px | PASS | Gerarchia lista/editor leggibile. |
| M-04 | Nav/safe area | PASS | Bottom nav non copre contenuto. |
| M-05 | Touch | PASS | CTA e controlli principali >=44 px. |
| M-06 | Hover/back | PASS | Nessun hover-only path; Annulla prevedibile. |
| M-07 | Keyboard/date | PASS | CTA preservata nel form verticale. |
| M-08 | Testi monetari | PASS | Importi e testi con wrapping it-IT. |
| M-09 | Mobile-first | PASS | Layout verticale dedicato. |

## Tablet

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px | PASS | Pannelli completi in E2E. |
| T-02 | Resize | PASS | Nessuna sovrapposizione. |
| T-03 | Touch | PASS | Form/lista sostenibili. |
| T-04 | Nav transition | PASS | Funzioni preservate. |

## Desktop

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px | PASS | Nessun testo troncato. |
| D-02 | 1440 px | PASS | Sidebar, top bar, lista/editor allineati. |
| D-03 | Tabelle/importi | PASS | Dati e azioni leggibili. |
| D-04 | Focus/disabled | PASS | Stati visibili e alternative hover. |
| D-05 | Overlay | PASS | Dialog/pannelli non si sovrappongono. |
| D-06 | Desktop-first split | PASS | Lista/editor dedicati. |

## Visuale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Token/spacing | PASS | Pattern Nexora preservati. |
| V-02 | Brand styles | PASS | Font, colori, radius condivisi. |
| V-03 | Primitives | PASS | Primitive UI e AccessibleDialog riusati. |
| V-04 | Stati | PASS | Empty, error, success, disabled, confirmation coerenti. |
| V-05 | Contrasto | PASS | Contrasto/allineamento leggibili. |
| V-06 | Motion | PASS | Nessuna informazione dipende da animazioni. |

## Ricerca

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Campo ricerca | N/A | Non applicabile: liste di pianificazione brevi, senza ricerca. |
| S-02 | Filtri | N/A | Non applicabile: nessun filtro previsto. |
| S-03 | Combinazioni | N/A | Non applicabile: nessun filtro/ordinamento. |
| S-04 | No results | N/A | Non applicabile: non esiste ricerca; empty list è presente. |
| S-05 | Mobile search | N/A | Non applicabile: nessun controllo ricerca previsto. |
| S-06 | Privacy | PASS | Nessun dato reale usato. |
| S-07 | Motivazione N/A | PASS | N/A motivate in S-01–S-05. |

## Form

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Campi/label | PASS | Ordine naturale e required. |
| F-02 | Mobile form | PASS | Monocolonna con input adeguati. |
| F-03 | Errori | PASS | role=alert sulla superficie. |
| F-04 | CTA/dialog | PASS | Salva, annulla e conferma distinti. |
| F-05 | Focus dialog | PASS | AccessibleDialog gestisce focus/Escape. |
| F-06 | Loading/double submit | PASS | Disabled e guardia salvataggi; retry idempotente. |
| F-07 | Overlay CTA | PASS | Nessuna copertura nei viewport. |
| F-08 | Money/date/select | PASS | Minor units, EUR, date e locale preservati. |

## Stati

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading | PASS | Salvataggio/esecuzione disabled/loading. |
| B-02 | Empty | PASS | Empty state con prossima azione per entrambe le liste. |
| B-03 | Error/retry | PASS | Errore e retry dopo parzialità. |
| B-04 | Offline/context | PASS | Copy chiarisce che la previsione non altera il saldo. |
| B-05 | Success | PASS | Feedback per save/execute/delete. |
| B-06 | Partial/disabled | PASS | Conti rimossi e trasferimenti già eseguiti esplicitati. |

## Accessibilita

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Semantica | PASS | Landmark, heading, label e nomi verificati in Chrome. |
| A-02 | Keyboard | PASS | Form/dialog con focus visibile. |
| A-03 | Contrasto | PASS | Stato non affidato solo al colore. |
| A-04 | Zoom | PASS | 200% verificato in E2E desktop. |
| A-05 | Annunci | PASS | alert/status e feedback presenti. |
| A-06 | Grafici | N/A | Non applicabile: nessun grafico presente. |
| A-07 | Touch | PASS | Target principali >=44 px. |
| A-08 | Reduced motion | PASS | Nessuna informazione dipende da animazioni. |
| A-09 | WCAG baseline | PASS | Dialog, focus e nav conformi al baseline. |

## Finanza

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Tipi | PASS | Entrata/uscita/transfer distinti. |
| N-02 | Transfer KPI | PASS | Due gambe transfer, escluse dai KPI. |
| N-03 | Segni/stato | PASS | Segni, conto, categoria e stato verificati. |
| N-04 | Riconducibilita | PASS | Preview mostra importo e origine → destinazione. |
| N-05 | Precisione | PASS | bigint/minor units; domain tests passati. |
| N-06 | Conferma/delete | PASS | Preview+conferma e delete protetto. |
| N-07 | Locale/date | PASS | EUR, it-IT, ISO, Europe/Rome. |
| N-08 | Domain boundary | PASS | Regole nel dominio/command layer. |

## Performance

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Responsivita | PASS | Primo contenuto/CTA prioritari. |
| Q-02 | Dataset | PASS | Demo/lista senza jank evidente. |
| Q-03 | Overlay/resize | PASS | Stabili dopo rendering. |
| Q-04 | Asset | PASS | Componenti proporzionati. |
| Q-05 | Offline/error | PASS | Error/retry locale comprensibile. |

## Criticita e decisione

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
Test automatici: 5 file/28 test mirati PASS; suite 589 PASS/4 skip; E2E 6 PASS.
Verifica manuale/visuale: Chrome headed, #recurring, 320 px e 1440 px; responsive E2E sugli altri viewport.
Riferimenti: MOCKUP_INTEGRATION, STITCH_UI_REFERENCE, DESIGN.md
Conclusione: SCREEN_AUDIT_PASS. Ricorrenze e Allocazioni congelate per C3; prossimo task C3.8.

Follow-up Chrome 2026-08-30: verificato nuovamente a 1440 px e 390 px; corretta la spaziatura
tipografica degli empty state affinché titolo e descrizione rispettino il margine verticale del
pattern Nexora. Inoltre il pannello desktop “Nuova ricorrenza” è stato portato a tutta larghezza,
coerente con “Nuovo piano” delle Allocazioni. Nessun overflow residuo.
