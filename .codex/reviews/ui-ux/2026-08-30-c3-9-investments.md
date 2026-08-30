# UI/UX screen review — Nexora checklist v2

Manifest: nexora-ui-ux-mobile-desktop/v2
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Investimenti / Investments
Route: #investments
Task/Fase: 12.5.C3.9
Branch: codex/phase-12-5-0-checkpoint
Data: 2026-08-30
Revisore: Codex — UI/QA review
Flusso principale: Investimenti → nuova posizione → lista → modifica → eliminazione
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom; keyboard; touch >=44 px
Code review: PASS
Code review evidence: InvestmentsPage.tsx, investmentCommands.ts, InvestmentPosition.ts, repository, Dashboard view model e test; Money/bigint, segni, zero-cost, valute, delete protetto e doppio submit verificati.
Automated browser verification: PASS
Automated browser evidence: pnpm exec playwright test test/e2e/investments.spec.ts --reporter=line — 6/6 PASS.
Visual browser verification: PASS
Visual browser route/surface: Chrome reale su http://127.0.0.1:5173/#investments.
Visual browser viewports: 320, 375, 390, 768, 1024, 1440 px; 200% zoom verificato con controllo responsive/reflow.
Visual browser interactions: stato vuoto/form, resize, lista, apertura modifica, delete dialog e CTA touch verificati; CRUD sintetico coperto da E2E e component test.
Visual browser evidence: nessun overflow; mobile monocolonna; tablet/desktop editor full-width; valori e azioni leggibili.
Visual browser screenshots: N/A motivata — evidenza headed acquisita e descritta qui.
Esito: UI_REVIEW_PASS

## Universale
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Gerarchia | PASS | Titolo, lista posizioni, valore corrente e form sono distinguibili. |
| U-02 | CTA/azioni | PASS | Salva, modifica, elimina e conferma sono nominati. |
| U-03 | Flusso reale | PASS | Create/update/delete e persistenza sono collegati ai command reali. |
| U-04 | Finanza | PASS | Rendimento deriva da currentValue - costBasis nel dominio. |
| U-05 | Robustezza | PASS | Overflow, stati disabled e doppio submit controllati. |

## Mobile
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px | PASS | Lista/form monocolonna, padding interno e nessun overflow. |
| M-02 | 375 px | PASS | Campi e importi leggibili. |
| M-03 | 390 px | PASS | Chrome: lista 343 px e editor 343 px entro viewport. |
| M-04 | Nav/safe area | PASS | Bottom navigation non copre il contenuto. |
| M-05 | Touch | PASS | Input e CTA hanno min-height 44 px. |
| M-06 | Hover/back | PASS | Nessun percorso dipende dal solo hover. |
| M-07 | Keyboard/date | PASS | Form verticale e date input utilizzabili. |
| M-08 | Testi/importi | PASS | Wrapping naturale e formato it-IT preservati. |
| M-09 | Mobile-first | PASS | La card/lista reflowa senza tabella compressa. |

## Tablet
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px | PASS | Lista/editor full-width e completi. |
| T-02 | Resize | PASS | Nessuna sovrapposizione o clipping. |
| T-03 | Touch | PASS | Controlli raggiungibili e >=44 px. |
| T-04 | Nav | PASS | Route e funzioni preservate. |

## Desktop
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px | PASS | Pannelli full-width leggibili. |
| D-02 | 1440 px | PASS | Editor riallineato full-width, nessuna colonna laterale stretta. |
| D-03 | Dati | PASS | Valore corrente, capitale, rendimento e data allineati. |
| D-04 | Stati | PASS | Focus, disabled e alert visibili. |
| D-05 | Overlay | PASS | Dialog delete non altera il layout sottostante. |
| D-06 | Layout | PASS | Pattern coerente con Ricorrenze e Prestiti. |

## Visuale
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Spacing | PASS | Token e padding interni coerenti. |
| V-02 | Brand | PASS | Font, colori e radius condivisi. |
| V-03 | Primitive | PASS | FinancialAmount e AccessibleDialog riusati. |
| V-04 | Stati | PASS | Empty, populated, error e delete coerenti. |
| V-05 | Contrasto | PASS | Segno e testo accompagnano il colore. |
| V-06 | Motion | PASS | Nessuna informazione dipende dall’animazione. |

## Ricerca
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Campo | N/A | N/A: nessuna ricerca prevista per posizioni. |
| S-02 | Filtri | N/A | N/A: nessun filtro previsto. |
| S-03 | Combinazioni | N/A | N/A: nessun ordinamento previsto. |
| S-04 | No results | N/A | N/A: l’empty state copre l’assenza di posizioni. |
| S-05 | Mobile | N/A | N/A: nessun controllo ricerca presente. |
| S-06 | Privacy | PASS | Solo dati sintetici nel browser/test. |
| S-07 | N/A | PASS | N/A motivate in S-01–S-05. |

## Form
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Campi | PASS | Label, required e ordine conto/nome/valori/data. |
| F-02 | Mobile | PASS | Form monocolonna a tutte le larghezze mobile. |
| F-03 | Errori | PASS | role=alert senza stack trace e input preservato. |
| F-04 | CTA | PASS | Salva, aggiorna, annulla e delete distinti. |
| F-05 | Dialog | PASS | Conferma distruttiva nominata e annullabile. |
| F-06 | Loading | PASS | Salvataggio disabilita la CTA e blocca il doppio submit. |
| F-07 | Overlay | PASS | Nessuna CTA coperta. |
| F-08 | Money/date | PASS | Parsing minor units e LocalDate reali. |

## Stati
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading | PASS | Stato Salvataggio… e Eliminazione… presente. |
| B-02 | Empty | PASS | Nessuna posizione e istruzione esplicita. |
| B-03 | Error | PASS | Errori create/update/delete comprensibili. |
| B-04 | Offline | PASS | Command e repository sono local-first, nessun falso errore rete. |
| B-05 | Success | PASS | Lista aggiornata dopo create/update/delete. |
| B-06 | Partial | PASS | Eliminazione non rimuove conto o movimenti. |

## Accessibilita
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Semantica | PASS | Heading, landmark, label e dialog presenti. |
| A-02 | Keyboard | PASS | Form, modifica, annulla e conferma hanno controlli nativi. |
| A-03 | Contrasto | PASS | Baseline AA e segnali testuali. |
| A-04 | Zoom | PASS | Reflow senza overflow critico a 200%. |
| A-05 | Annunci | PASS | Alert e dialog hanno nomi/accessibility semantics. |
| A-06 | Grafici | N/A | N/A: nessun grafico presente nella superficie. |
| A-07 | Touch | PASS | Target principali >=44 px. |
| A-08 | Motion | PASS | Nessuna informazione solo animata. |
| A-09 | WCAG | PASS | Focus, form e dialog baseline AA. |

## Finanza
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Tipi | PASS | Posizioni separate da movimenti e conti liquidi. |
| N-02 | KPI | PASS | Investimenti esclusi da Disponibilità attuale Dashboard. |
| N-03 | Valori | PASS | Capitale e valore corrente sono reali e non negativi. |
| N-04 | Riconducibilita | PASS | Lista e modifica mostrano gli stessi valori. |
| N-05 | Precisione | PASS | Money/bigint; test perdita, zero, >100% e capitale zero. |
| N-06 | Delete | PASS | Conferma; conto e movimenti restano invariati. |
| N-07 | Locale | PASS | EUR/it-IT, date ISO e Europe/Rome. |
| N-08 | Domain | PASS | Currency match e account investment validati nel dominio/repository. |

## Performance
| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Risposta | PASS | CTA e form disponibili al primo render locale. |
| Q-02 | Dataset | PASS | Lista sintetica senza jank evidente. |
| Q-03 | Overlay | PASS | Dialog stabile. |
| Q-04 | Componenti | PASS | Surface proporzionata e senza librerie nuove. |
| Q-05 | Offline/error | PASS | Errori locali comprensibili. |

## Criticita e decisione
P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno

Portfolio totale/distribuzione grafica e dettaglio separato: N/A motivata — il modello corrente espone
posizioni singole e riepiloghi Dashboard per valuta, ma non un aggregato multi-valuta, grafico o route
di dettaglio distinta. La lista espone tutti i dati reali e Modifica apre il dettaglio operativo; non è
stata introdotta un’aggregazione EUR+USD priva di conversione.

Test automatici: component/domain mirati 10/10 PASS; E2E Investimenti 6/6 PASS; suite completa 595 PASS / 4 skip.
Verifica manuale/visuale: Chrome headed #investments a 390 e 1440 px; resize metrici 320/375/390/768/1024/1440; nessun overflow.
Riferimenti: MOCKUP_INTEGRATION, STITCH_UI_REFERENCE, DESIGN.md, C3_SCREEN_AUDIT_FRAMEWORK.

Conclusione: SCREEN_AUDIT_PASS. Investimenti è congelata per C3; prossimo task C3.10.
