# 12.5.C3.3-R2 — Dashboard/Home monthly financial overview correction

Framework: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Manifest: `nexora-ui-ux-mobile-desktop/v2`
Surface: Dashboard/Home
Schermata: Dashboard / Home
Route/contenitore: `#overview`
Task/Fase: 12.5.C3.3-R2
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-08-26
Revisore: Codex — UI/UX + QA
Result: `SCREEN_AUDIT_PASS`
Esito: UI_REVIEW_PASS
Route: `#overview`; nessuna route nuova
Flusso principale: ingresso → stato vuoto → dati demo sintetici → riepilogo → movimenti/conti
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; zoom 200%; keyboard-only; touch >=44×44 px
Code review: PASS
Code review evidence: Dashboard and ViewModel inspected for real monthly projections and domain invariants.
Automated browser verification: PASS
Automated browser evidence: Playwright C3 dashboard suite passed on six Chromium viewport projects with axe and overflow checks.
Visual browser verification: PASS
Visual browser route/surface: Rendered `#overview` populated state in the production preview.
Visual browser viewports: 320, 375, 390, 768, 1024, 1440 px; 200% zoom.
Visual browser interactions: Empty CTA via keyboard, demo seed, navigation links and responsive reflow verified.
Visual browser evidence: The rendered hierarchy begins with month/status and liquid availability, followed by monthly KPIs, budget, recurring expenses, trend and categories.
Visual browser screenshots: `test/e2e/dashboard.spec.ts-snapshots/dashboard-1440-chromium-1440-win32.png` plus Playwright artifacts for the six viewport runs.

## Scope e implementazione reale

Verificati `Dashboard`, `buildDashboardViewModel`, `MetricCard`, `FinancialAmount`, il riepilogo
dei conti e l’attività recente. Il view model usa conti, categorie, transazioni, transfer, prestiti
e investimenti persistiti; i trasferimenti sono collassati in una sola attività neutrale e restano
esclusi da entrate/spese. L’empty state usa esclusivamente il seed dimostrativo esplicito.

## Rilievi iniziali e correzioni

### P0

Nessuno.

### P1

- **DASH-P1-01 risolto:** l’audit axe desktop rilevava `aria-expanded` non supportato sul campo
  ricerca globale presente nella shell della Dashboard. Il campo ora dichiara il ruolo `combobox`,
  coerente con `listbox/option`; nessuna logica o destinazione di ricerca è cambiata.

### P2

Nessuno lasciato aperto.

## Viewport e browser evidence

| Area | Esito | Evidence |
| --- | --- | --- |
| 320 px | PASS | `c3-dashboard-audit.spec.ts`, empty→seed, axe, touch e overflow |
| 375 px | PASS | stesso flusso browser su progetto Chromium 375 |
| 390 px | PASS | stesso flusso browser su progetto Chromium 390 |
| 768 px | PASS | stesso flusso browser su tablet, axe e overflow |
| 1024 px | PASS | Dashboard desktop, axe, dati sintetici e zoom 200% |
| 1440 px | PASS | Dashboard desktop, screenshot baseline, axe e zoom 200% |
| Zoom 200% | PASS | CDP `Emulation.setDeviceMetricsOverride`: 1024→512 e 1440→720 CSS px |
| Keyboard/touch | PASS | Enter sulla CTA empty e target demo misurato >=44 px |

## Mobile-first e responsive

PASS. A 320/375/390 il contenuto prioritario parte dal titolo e dallo stato vuoto; dopo il seed le
metriche diventano una colonna leggibile, seguite da movimenti recenti e conti. A 768 il layout
usa il reflow tablet; a 1024/1440 le metriche e i pannelli sfruttano la griglia desktop. Nessun
overflow orizzontale, clipping di importi o CTA irraggiungibile è emerso.

Le 11 domande mobile-first sono PASS: gerarchia immediata, CTA raggiungibile, target >=44 px,
keyboard non bloccante, bottom navigation separata dal contenuto, safe-area ereditata dalla shell,
nessuna tabella compressa senza etichette, pannelli leggibili, nessun dialog Dashboard e importi
leggibili in `it-IT`.

## Funzionalità, stati e finanza

- PASS stato vuoto con seed sintetico esplicito, CTA disabilitabile durante la creazione e feedback.
- PASS metriche reali: patrimonio, entrate, spese, saldo flussi, debiti e investimenti.
- PASS trasferimenti interni esclusi dai flussi e mostrati una sola volta come neutrali.
- PASS annullati visibili nell’attività ma esclusi da saldi e flussi; denaro in minor units/BigInt.
- PASS conti in valuta diversa esclusi dal patrimonio senza conversioni implicite.
- PASS attività recente, conto, categoria, data e importo hanno contesto testuale accessibile.
- N/A loading/error: bootstrap e recovery possiedono gli stati reali fuori dalla Dashboard pronta;
  non è stato inventato uno stato asincrono per una proiezione locale sincrona.
- PASS offline: la pagina e il seed lavorano sul ledger locale; nessuna rete è necessaria.

## Coerenza Stitch e divergenze deliberate

PASS rispetto a `docs/ux/MOCKUP_INTEGRATION.md`, `docs/ux/STITCH_SCREEN_MATRIX.md`,
`docs/ux/STITCH_UI_REFERENCE.md` e `design/mockup/stitch/DESIGN.md`: metric cards persistenti,
card con padding/divider, gerarchia pulita, token Nexora e tabella responsive. Divergenza deliberata:
la Dashboard mostra proiezioni finanziarie reali e uno stato vuoto esplicito invece di dati fittizi
automatici del mockup.

## File modificati

- `packages/ui/src/TopHeader.tsx` — correzione ARIA condivisa rilevata nel browser.
- `test/e2e/c3-dashboard-audit.spec.ts` — browser evidence C3.3.

## Test

- `pnpm exec vitest run apps/web/src/dashboard/buildDashboardViewModel.test.ts`: 1 file, 5/5 PASS.
- `pnpm build`: PASS; advisory preesistente sui chunk oltre 500 kB.
- `pnpm exec playwright test test/e2e/c3-dashboard-audit.spec.ts test/e2e/dashboard.spec.ts` sui
  progetti 320/375/390/768/1024/1440: 19 PASS, 5 skip intenzionali per screenshot/zoom non applicabili.
- Browser axe passa su tutti i viewport eseguiti; la regressione ARIA desktop è chiusa.

## Conclusione e freeze

`SCREEN_AUDIT_PASS`. P0=0, P1=0, P2=0. Dashboard/Home è congelata per C3; modifiche successive
solo per regressione dimostrata, problema cross-screen, P0/P1, accessibilità, sicurezza o correttezza.

## Universale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Gerarchia | PASS | Titolo, metriche, attività e conti hanno ordine verificato. |
| U-02 | CTA | PASS | Seed demo è nominato e raggiungibile nello stato vuoto. |
| U-03 | Flusso | PASS | Empty→seed→riepilogo passa nel browser locale. |
| U-04 | Invarianti | PASS | Transfer e annullati rispettano le proiezioni testate. |
| U-05 | Robustezza | PASS | Valute, importi, vuoto e overflow sono verificati. |

## Mobile

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px | PASS | E2E C3.3 passa empty, seed, axe e overflow. |
| M-02 | 375 px | PASS | E2E C3.3 passa il flusso a 375 px. |
| M-03 | 390 px | PASS | E2E C3.3 passa il flusso a 390 px. |
| M-04 | Safe area | PASS | Shell e bottom navigation riservano area sicura. |
| M-05 | Touch | PASS | CTA demo misurata almeno 44 px nel browser. |
| M-06 | Hover | PASS | Nessuna azione primaria dipende da hover. |
| M-07 | Tastiera | PASS | Focus CTA ed Enter completano il seed sintetico. |
| M-08 | Testi | PASS | Card e celle usano wrapping e label responsive. |
| M-09 | Priorita | PASS | Metriche, movimenti e conti seguono la gerarchia mobile. |

## Tablet

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px | PASS | Browser tablet mostra Dashboard senza overflow. |
| T-02 | Reflow | PASS | Griglia metriche e pannelli passano a colonna. |
| T-03 | Touch | PASS | CTA e shell restano utilizzabili al breakpoint. |
| T-04 | Navigazione | PASS | Bottom navigation non copre il contenuto Dashboard. |

## Desktop

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px | PASS | Metriche e pannelli restano leggibili. |
| D-02 | 1440 px | PASS | Screenshot baseline e browser axe passano. |
| D-03 | Dati | PASS | Metriche e attività derivano dal view model reale. |
| D-04 | Stati | PASS | Empty, feedback seed, annullato e valuta sono distinti. |
| D-05 | Pannelli | PASS | Attività e conti non competono né escono dalla griglia. |
| D-06 | Layout | PASS | Card, padding e divider rispettano token Stitch. |

## Visuale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Gerarchia | PASS | Patrimonio e metriche hanno priorità visiva. |
| V-02 | Token | PASS | Colori, font, radius e spacing usano token esistenti. |
| V-03 | Primitive | PASS | MetricCard e FinancialAmount sono condivisi. |
| V-04 | Stati | PASS | Positivo, negativo, neutro e annullato hanno testo. |
| V-05 | Contrasto | PASS | Axe passa nei flussi Dashboard multi-viewport. |
| V-06 | Motion | PASS | Nessuna animazione necessaria per la lettura dati. |

## Ricerca

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Search | PASS | Campo shell resta nominato e combobox valido. |
| S-02 | Clear/reset | PASS | La correzione ARIA non altera clear o reset. |
| S-03 | Combinazioni | PASS | Dashboard non aggiunge filtri o query inventate. |
| S-04 | Empty | PASS | Empty Dashboard è distinto da no-results ricerca. |
| S-05 | Selected | PASS | Ricerca resta destinazione reale della shell. |
| S-06 | Privacy | PASS | Dashboard usa dati locali senza log finanziari. |
| S-07 | Disponibilita | PASS | La shell resta usabile offline con ledger locale. |

## Form

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Campi | N/A | N/A: Dashboard non contiene form persistente. |
| F-02 | Mobile | PASS | CTA empty è usabile a 320 px. |
| F-03 | Errori | N/A | N/A: errori form non applicabili alla superficie. |
| F-04 | CTA | PASS | Seed ha label, feedback e disabled state. |
| F-05 | Overlay | N/A | N/A: nessun dialog Dashboard. |
| F-06 | Loading | PASS | CTA riflette `isSeeding` durante il seed. |
| F-07 | Layout | PASS | CTA e card reflowano senza clipping. |
| F-08 | Dati | PASS | Seed è esplicito e interamente sintetico. |

## Stati

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading | N/A | N/A: bootstrap loading è fuori dalla Dashboard pronta. |
| B-02 | Empty | PASS | Ledger vuoto mostra CTA demo esplicita. |
| B-03 | Error | N/A | N/A: error state appartiene a startup/recovery. |
| B-04 | Offline | PASS | Ledger locale e Dashboard non richiedono rete. |
| B-05 | Successo | PASS | Feedback seed comunica salvataggio locale. |
| B-06 | Disabled | PASS | CTA si disabilita mentre crea dati demo. |

## Accessibilita

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Nomi | PASS | Heading, regioni, CTA e tabella hanno nomi accessibili. |
| A-02 | Keyboard | PASS | Focus CTA ed Enter sono verificati in E2E. |
| A-03 | Contrasto | PASS | Axe e testo semantico passano sui viewport. |
| A-04 | Zoom | PASS | CDP 200% passa su 1024 e 1440 senza overflow. |
| A-05 | Annunci | PASS | Feedback seed usa `role=status`; tabella ha caption. |
| A-06 | Dati | PASS | Importi e stati non dipendono solo dal colore. |
| A-07 | Touch | PASS | CTA primaria misura almeno 44 px. |
| A-08 | Motion | PASS | Nessuna motion necessaria per la comprensione. |
| A-09 | WCAG | PASS | Axe passa; combobox shell ora usa ARIA supportata. |

## Finanza

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Tipi | PASS | Entrate/spese sono calcolate da Money minor units. |
| N-02 | Transfer | PASS | Transfer esclusi dai flussi e collassati nell’attività. |
| N-03 | Dati | PASS | View model usa ledger e proiezioni reali. |
| N-04 | Riconducibilita | PASS | KPI, conti e righe hanno sorgente locale verificata. |
| N-05 | Precisione | PASS | BigInt/FinancialAmount mantiene precisione e locale. |
| N-06 | Protezioni | PASS | Dashboard non esegue mutation finanziarie implicite. |
| N-07 | Locale | PASS | Importi e date sono formattati per `it-IT`. |
| N-08 | Dominio | PASS | Test coprono valute, annullati e seed sintetico. |

## Performance

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Risposta | PASS | Empty→seed e rendering passano nei flussi E2E. |
| Q-02 | Dataset | PASS | Attività recente è limitata a sei elementi. |
| Q-03 | Layout | PASS | Sei viewport e zoom restano stabili. |
| Q-04 | Proporzione | PASS | Nessuna dipendenza o rete nuova aggiunta. |
| Q-05 | Error/offline | PASS | Proiezione locale resta disponibile offline. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
