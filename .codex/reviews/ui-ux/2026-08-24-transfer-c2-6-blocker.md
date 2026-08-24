# UI/UX screen review — Nexora checklist v2

Manifest: nexora-ui-ux-mobile-desktop/v2
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Movimenti — azioni e dettaglio trasferimento
Route: #transactions
Task/Fase: 12.5.C2.6-R — Risoluzione blocker modifica Trasferimenti
Branch: codex/phase-12-5-0-checkpoint
Data: 2026-08-24
Revisore: Codex — Nexora UI/QA
Flusso principale: creazione trasferimento → visualizzazione → dettaglio → annullamento; nessuna modifica
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom; keyboard; touch >=44 px
Esito: UI_REVIEW_PASS

## Universale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Gerarchia comprensibile | PASS | Lista, menu e dettaglio distinguono chiaramente trasferimento e azioni disponibili. |
| U-02 | CTA e terminologia coerenti | PASS | “Annulla” resta disponibile; “Modifica” non viene esposta per transfer. |
| U-03 | Flusso reale verificato | PASS | Component test ed E2E usano route, view model e ledger reali. |
| U-04 | Nessuna logica finanziaria impropria | PASS | Nessuna modifica a KPI, Money, repository o command di creazione. |
| U-05 | Overflow/focus/touch controllati | PASS | E2E Movimenti 60/60 verifica overflow; menu e dettaglio preservano focus/Escape. |

## Mobile

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px | PASS | E2E chromium-320 passa creazione, dettaglio/azioni esistenti e annullamento transfer. |
| M-02 | 375 px | PASS | E2E chromium-375 passa i flussi Movimenti. |
| M-03 | 390 px | PASS | E2E chromium-390 passa i flussi Movimenti. |
| M-04 | Safe area/overlay | PASS | Nessun overlay nuovo; dettaglio condiviso non copre azioni di modifica inesistenti. |
| M-05 | Touch >=44 px | PASS | Controlli esistenti e menu restano invariati; smoke responsive verde. |
| M-06 | Nessun hover-only | PASS | Azioni accessibili da menu tastiera/touch; “Modifica” è assente per transfer. |
| M-07 | Tastiera/select/CTA | PASS | E2E copre form transfer e CTA a viewport mobili. |
| M-08 | Importi/testi | PASS | Importo resta `Money` in minor units; dettaglio mostra dati disponibili. |
| M-09 | Mobile-first | PASS | Nessun nuovo layout; protezione usa la stessa lista/dettaglio responsive. |

## Tablet

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px completo | PASS | E2E chromium-768 passa il flusso transfer. |
| T-02 | Ridimensionamento | PASS | E2E Movimenti passa senza overflow o sovrapposizioni. |
| T-03 | Touch sostenibile | PASS | Nessun nuovo controllo; menu esistente resta utilizzabile. |
| T-04 | Transizione navigazione | PASS | Nessuna modifica alla navigazione o ai pannelli. |

## Desktop

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px | PASS | E2E chromium-1024 passa creazione e annullamento transfer. |
| D-02 | 1440 px | PASS | E2E chromium-1440 passa il flusso completo. |
| D-03 | Lista/dettaglio leggibili | PASS | Test dettaglio verifica origine, destinazione, importo e data. |
| D-04 | Focus/pressed/disabled | PASS | Test menu verifica focus di ritorno con Escape; azioni non disponibili non sono renderizzate. |
| D-05 | Azioni contestuali | PASS | Il menu transfer contiene annulla/cestino ma non modifica. |
| D-06 | Layout desktop | PASS | Nessun layout desktop modificato. |

## Visuale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Gerarchia/token | PASS | Nessun token o spacing modificato; superficie esistente preservata. |
| V-02 | Colori/font/icon | PASS | Nessun asset, colore o font modificato. |
| V-03 | Primitive condivise | PASS | Lista e dettaglio esistenti riusati senza markup Stitch copiato. |
| V-04 | Stati coerenti | PASS | Transfer resta neutro e read-only, con annullamento già supportato. |
| V-05 | Contrasto/allineamento | PASS | Nessuna variazione visuale introdotta. |
| V-06 | Movimento | N/A | Nessuna animazione o transizione modificata. |

## Ricerca

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Ricerca riconoscibile | PASS | Superficie di ricerca esistente non modificata; E2E passa. |
| S-02 | Filtri/reset | PASS | Filtri esistenti non modificati; E2E passa. |
| S-03 | Combinazioni | PASS | E2E copre combinazione filtri e ordinamento. |
| S-04 | Nessun risultato | PASS | Stato esistente resta disponibile. |
| S-05 | Selected/mobile | PASS | Dettaglio selezionato e responsive smoke passano. |
| S-06 | Privacy | PASS | Nessun dato reale o log aggiunto. |
| S-07 | Presente | PASS | La superficie offre ricerca e filtri, coperti dai test esistenti. |

## Form

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Ordine e label | PASS | Form transfer esistente resta Da → A → Importo → Data → Descrizione. |
| F-02 | Form mobile | PASS | E2E 320/375/390 passa il form. |
| F-03 | Errori comprensibili | PASS | Guardia produce messaggio controllato in `role=alert`. |
| F-04 | CTA/annulla | PASS | Lo stato impossibile non salva e non chiude il form. |
| F-05 | Overlay focus | PASS | Nessun dialog nuovo; focus behavior esistente preservato. |
| F-06 | Loading/doppio submit | PASS | Guard non invoca callback; `isSaving` esistente invariato. |
| F-07 | CTA visibile | PASS | Nessun layout o overlay nuovo. |
| F-08 | Money/date/select | PASS | Guard viene eseguita prima di creare; contratto minor units invariato. |

## Stati

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading | PASS | Stato di salvataggio esistente invariato. |
| B-02 | Empty | PASS | Empty state non modificato. |
| B-03 | Error/recovery | PASS | Errore controllato spiega che transfer registrati non sono modificabili. |
| B-04 | Offline | PASS | Nessuna persistenza o gestione offline modificata. |
| B-05 | Successo/undo | PASS | Creazione e annullamento E2E passano. |
| B-06 | Disabled/conflitti | PASS | Stato impossibile è bloccato senza scrittura. |

## Accessibilita

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Nomi e landmark | PASS | Test component/accessibilità usa ruoli menu, dettaglio e alert. |
| A-02 | Keyboard-only | PASS | Escape/focus return esistenti passano; menu non offre modifica. |
| A-03 | Contrasto | N/A | Nessun colore o stile modificato in questa correzione. |
| A-04 | Zoom 200% | N/A | Nessun layout, dimensione, stile o contenuto visuale modificato; non è stato introdotto un controllo zoom dedicato. |
| A-05 | Error announcement | PASS | La guardia usa `role=alert` con messaggio esplicito. |
| A-06 | Dati complessi | N/A | Nessun grafico o dato complesso introdotto. |
| A-07 | Touch/hover | PASS | Azioni non dipendono da hover; transfer edit è assente. |
| A-08 | Reduced motion | N/A | Nessuna animazione modificata. |
| A-09 | WCAG base | PASS | Test accessibilità ed E2E esistenti passano. |

## Finanza

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Tipi distinti | PASS | Transfer resta distinto da Entrata/Uscita. |
| N-02 | Una operazione/KPI | PASS | View model e KPI invariati; E2E transfer passa. |
| N-03 | Segno/conto/stato | PASS | Dettaglio mostra origine/destinazione e importo neutro. |
| N-04 | Riconducibilità | PASS | Test verifica dati del bundle visualizzato. |
| N-05 | Money/minor units | PASS | Nessun cambio a Money o minor units. |
| N-06 | Distruttive protette | PASS | Annullamento/cestino restano azioni esistenti. |
| N-07 | Locale/date | PASS | Nessun cambio a locale o date. |
| N-08 | Dominio preservato | PASS | Nessun `updateTransfer`; guardia inoltra solo lo stato impossibile come errore controllato. |

## Performance

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Risposta interazioni | PASS | Nessuna nuova operazione costosa. |
| Q-02 | Dataset realistico | PASS | Full test e E2E Movimenti verdi. |
| Q-03 | Overlay stabile | PASS | Nessun overlay nuovo. |
| Q-04 | Asset proporzionati | PASS | Nessun asset o componente nuovo. |
| Q-05 | Offline/recupero | PASS | Nessun percorso offline modificato. |

## Criticita e decisione

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
Test automatici: `pnpm vitest run` — 136 file passati, 567 test passati, 1 file skipped e 4 test skipped; `pnpm exec playwright test test/e2e/transactions.spec.ts` — 60 passed.
Verifica manuale/visuale: E2E responsive 320/375/390/768/1024/1440; A-04 N/A motivato perché nessun layout/stile è stato modificato.
Riferimenti: `docs/ux/MOCKUP_INTEGRATION.md`, `docs/ux/STITCH_UI_REFERENCE.md`, `docs/DECISIONS_LOG.md`
Esito: RESOLVED / UI_REVIEW_PASS
