# 12.5.C3.2 — Global Search Mobile/Desktop audit

Framework: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Manifest: `nexora-ui-ux-mobile-desktop/v2`
Surface: Global Search
Schermata: Ricerca globale
Route/contenitore: `#search` nella shell
Task/Fase: 12.5.C3.2
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-08-24
Revisore: Codex — UI/UX + QA
Result: `SCREEN_AUDIT_PASS`
Esito: UI_REVIEW_PASS
Route: `#search` nella shell; nessuna route nuova
Flusso principale: trigger → campo → query → risultato → destinazione reale
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; zoom 200%; keyboard-only; touch >=44×44 px
Code review: PASS
Code review evidence: `packages/ui/src/TopHeader.tsx` now restores focus through `inputRef` after desktop clear; regression assertion added to `packages/ui/src/AppShell.test.tsx`.
Automated browser verification: PASS
Automated browser evidence: `test/e2e/global-search.spec.ts` — 15 PASS, 9 intentional skips; desktop clear-focus assertion passes at 1024 and 1440.
Visual browser verification: PASS
Visual browser route/surface: `http://localhost:5173/#overview` — Global Search in the Nexora shell.
Visual browser viewports: 320, 375, 390, 768, 1024, 1440 px and 200% zoom covered by the updated C3.2 browser matrix.
Visual browser interactions: open trigger, type query, no-results, clear, keyboard focus, Escape, result selection and responsive resize.
Visual browser evidence: Chrome reale conferma query vuota dopo clear con `#global-search` ancora focalizzato; screenshot archiviato nell’audit Chrome.
Visual browser screenshots: `C:\Users\Roi23\.codex\visualizations\2026\08\25\nexora-chrome-search\01-global-search-chrome.png`; existing C3.2 screenshots/evidence retained.
Code review: PASS
Code review evidence: `packages/ui/src/TopHeader.tsx` now restores focus through `inputRef` after desktop clear; regression assertion added to `packages/ui/src/AppShell.test.tsx`.
Automated browser verification: PASS
Automated browser evidence: `test/e2e/global-search.spec.ts` — 15 PASS, 9 intentional skips; desktop clear-focus assertion passes at 1024 and 1440.
Visual browser verification: PASS
Visual browser route/surface: `http://localhost:5173/#overview` — Global Search in the Nexora shell.
Visual browser viewports: 320, 375, 390, 768, 1024, 1440 px and 200% zoom covered by the existing C3.2 browser matrix.
Visual browser interactions: open trigger, type query, no-results, clear, keyboard focus, Escape, result selection and responsive resize.
Visual browser evidence: Chrome reale conferma query vuota dopo clear con `#global-search` ancora focalizzato; screenshot archiviato nell’audit Chrome.
Visual browser screenshots: `C:\Users\Roi23\.codex\visualizations\2026\08\25\nexora-chrome-search\01-global-search-chrome.png`; existing C3.2 screenshots/evidence retained.

## Scope e implementazione reale

Verificati `GlobalSearch`, `TopHeader`, `MobileHeader`, `AppShell`, `GlobalSearchDialog`,
`filterGlobalSearchResults` e `buildGlobalSearchResults`. Le tipologie restano quelle già
proiettate dal codice: conti, categorie, tag, movimenti, prestiti e investimenti. Non sono state
aggiunte categorie, API, indici, persistenza o servizi online. Le destinazioni sono gli hash route
reali `#accounts`, `#categories`, `#tags`, `#transactions`, `#loans` e `#investments`.

## Rilievi iniziali e correzioni

### P0

Nessuno.

### P1

- **GS-P1-01 risolto:** la ricerca era assente sotto 768 px perché `TopHeader` veniva nascosto e
  `MobileHeader` non aveva un trigger. Aggiunto il trigger mobile e un dialog full-screen che usa
  lo stesso motore/proiezione locale, con focus automatico, Escape, focus return e scroll lock.
- **GS-P1-02 risolto:** il percorso tastiera e il focus dei risultati non erano completi. Aggiunti
  listbox/option semantics, `aria-activedescendant`, Arrow Up/Down, Enter, Tab trap, focus visible
  e chiusura senza overlay residui.
- **GS-P1-03 risolto:** il clear desktop rimuoveva la query ma lasciava il focus sul `body`. `TopHeader`
  ora conserva un ref dell’input e ripristina il focus dopo il clear; aggiunta regressione component/E2E.

### P2

Nessuno lasciato aperto: clear action, empty query, no-results e target touch sono stati inclusi
nella correzione e nella verifica.

## Viewport e browser evidence

| Area | Esito | Evidence |
| --- | --- | --- |
| 320 px | PASS | `test/e2e/global-search.spec.ts`, apertura/query/navigazione e no-results/clear/Escape |
| 375 px | PASS | stesso flusso browser multi-viewport |
| 390 px | PASS | stesso flusso browser multi-viewport |
| 768 px | PASS | trigger mobile, keyboard result, touch target e resize live |
| 1024 px | PASS | TopHeader desktop, risultati, no-results/clear e zoom 200% |
| 1440 px | PASS | TopHeader desktop, risultati, no-results/clear e zoom 200% |
| Zoom 200% | PASS | CDP `Emulation.setDeviceMetricsOverride`: 1024→512 e 1440→720 CSS px; overflow assente |
| Resize live | PASS | ricerca aperta `768→390→320→1440`, query preservata e dialog singolo |

## Mobile-first e responsive

PASS. A 320/375/390 il trigger è raggiungibile dall’header, il dialog usa safe-area inset,
il campo riceve focus immediato, i risultati scorrono internamente e il contenuto non presenta
overflow. A 768 la scelta è esplicitamente mobile, senza sidebar o ricerca desktop duplicata.
Il percorso `768→390→320→1440` conserva query e superficie aperta; a desktop la TopHeader resta
disponibile e il dialog mobile aperto non duplica risultati.

Le domande mobile-first sono tutte PASS: contenuto prioritario visibile, trigger raggiungibile con
una mano, controlli >=44 px, tastiera virtuale non bloccante, safe area rispettata, nessuna tabella
compressa, dialog utilizzabile, nessun overflow e testo/nomi lunghi con `overflow-wrap:anywhere`.

## Funzionalità, stati e navigazione

- PASS apertura mobile e desktop, query Unicode/spazi trim, query vuota con prompt locale e clear con
  ritorno focus verificato anche sul campo desktop.
- PASS risultati reali, massimo 8 elementi, titolo e contesto minimo leggibile.
- PASS no-results distinto dall’empty query; campo e clear restano disponibili.
- PASS click/tap e Enter su risultato; chiusura ricerca, hash route reale e active navigation.
- PASS ricerca locale offline: nessuna richiesta di rete e nessun messaggio di rete fuorviante.
- N/A loading/error: il motore corrente è una proiezione sincrona locale e non espone operazioni
  asincrone o un errore realistico nello strato auditato; non è stato inventato uno stato nuovo.
- PASS performance proporzionata: digitazione, clear, riapertura e lista limitata a 8 risultati
  senza lag osservabile nel browser evidence.

## Accessibilità e privacy

PASS. Dialog nominato e `aria-modal`, campo con accessible name, clear/close nominati, listbox e
option coerenti, stato no-results leggibile, focus automatico/visibile/return, Escape, Tab trap,
Arrow Up/Down ed Enter. I target trigger, close, clear e risultati sono >=44 px. La ricerca usa solo
dati locali già proiettati; query e dati finanziari non vengono loggati né inviati a servizi esterni.

## Coerenza Stitch e divergenze deliberate

PASS rispetto a `docs/ux/MOCKUP_INTEGRATION.md`, `docs/ux/STITCH_SCREEN_MATRIX.md`,
`docs/ux/STITCH_UI_REFERENCE.md` e `design/mockup/stitch/DESIGN.md`: superfici pulite, pill input,
overlay flottante, tipografia/token Nexora e densità desktop preservati. Divergenza deliberata:
mobile usa una ricerca full-screen dedicata invece di comprimere la command palette desktop, come
richiesto dal contratto C3 e dal piano mobile.

## File modificati

- `packages/ui/src/GlobalSearchDialog.tsx`
- `packages/ui/src/TopHeader.tsx`
- `packages/ui/src/MobileHeader.tsx`
- `packages/ui/src/AppShell.tsx`
- `packages/ui/src/styles.css`
- `packages/ui/src/index.ts`
- `packages/ui/src/AppShell.test.tsx`
- `test/e2e/global-search.spec.ts`

Nessuna modifica a dominio, database, repository, importer, backup, Tauri, Movimenti o App Shell
fuori dall’integrazione della ricerca.

## Test

- `pnpm exec vitest run packages/ui/src/GlobalSearch.test.ts packages/ui/src/AppShell.test.tsx`:
  2 file, 10/10 PASS, 0 skip; include regressione focus clear desktop.
- `pnpm --filter @nexora/ui typecheck`: PASS.
- `pnpm --filter @nexora/web typecheck`: PASS.
- `pnpm exec playwright test test/e2e/global-search.spec.ts`: 15 PASS, 9 skip intenzionali;
  2 test base su ciascuno dei 6 viewport, clear focus desktop, keyboard/resize su 768, zoom su 1024/1440.
- `pnpm build`: PASS; advisory preesistente sui chunk oltre 500 kB.

## Conclusione e freeze

`SCREEN_AUDIT_PASS`. P0=0, P1=0, P2=0. Global Search è congelata per C3; modifiche successive
solo per regressione dimostrata, P0/P1, problema cross-screen, accessibilità, sicurezza o
correttezza funzionale.

## Universale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Gerarchia | PASS | Header, campo, risultati e destinazione hanno ordine verificato. |
| U-02 | CTA | PASS | Trigger, clear, close e risultato sono distinguibili e nominati. |
| U-03 | Flusso | PASS | Query, selezione, chiusura e hash route reale passano nel browser. |
| U-04 | Invarianti | PASS | La ricerca legge proiezioni locali e non modifica il ledger. |
| U-05 | Robustezza | PASS | Query vuota, no-results, testi lunghi e overflow sono verificati. |

## Mobile

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px | PASS | Browser C3.2 passa apertura, query, risultato e no-results a 320 px. |
| M-02 | 375 px | PASS | Browser C3.2 passa il flusso completo a 375 px. |
| M-03 | 390 px | PASS | Browser C3.2 passa il flusso completo a 390 px. |
| M-04 | Safe area | PASS | Dialog e header usano safe-area inset e padding responsive. |
| M-05 | Touch | PASS | Trigger, clear, close e risultati hanno almeno 44 px. |
| M-06 | Hover | PASS | Uso mobile non dipende da hover; focus e selected sono visibili. |
| M-07 | Tastiera | PASS | Focus, Escape, Tab, Enter e Arrow sono coperti tra component e browser. |
| M-08 | Testi | PASS | Query e nomi lunghi usano wrapping senza rompere il dialog. |
| M-09 | Variante | PASS | Mobile usa dialog full-screen dedicato, non palette desktop compressa. |

## Tablet

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px | PASS | Trigger mobile e dialog unico passano a 768 px. |
| T-02 | Reflow | PASS | Resize live 768→390→320→1440 conserva query e overlay. |
| T-03 | Touch | PASS | Target touch del trigger e dei controlli sono misurati nel browser. |
| T-04 | Navigazione | PASS | Tablet non mostra sidebar e overlay ricerca duplicati. |

## Desktop

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px | PASS | TopHeader, input, risultati e clear passano a 1024 px. |
| D-02 | 1440 px | PASS | Densità, max-width e risultati passano a 1440 px. |
| D-03 | Dati | PASS | Risultati locali mostrano label e contesto reale coerente. |
| D-04 | Stati | PASS | Focus, selected, clear e no-results hanno stato visibile. |
| D-05 | Pannelli | PASS | Dropdown/dialog non lasciano backdrop o scroll lock residui. |
| D-06 | Layout | PASS | TopHeader desktop segue token e gerarchia Stitch approvati. |

## Visuale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Gerarchia | PASS | Campo e risultati mantengono priorità visiva nella shell. |
| V-02 | Token | PASS | Colori, font, radius, focus e spacing riusano token Nexora. |
| V-03 | Primitive | PASS | AppShell, TopHeader, MobileHeader e NavIcon sono riusati. |
| V-04 | Stati | PASS | Hover, focus, selected, empty e no-results sono distinti. |
| V-05 | Contrasto | PASS | Focus e superfici sono verificati con axe nei flussi UI. |
| V-06 | Motion | PASS | Dialog e resize restano utilizzabili con reduced motion. |

## Ricerca

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Search | PASS | Campo desktop/mobile ha accessible name “Ricerca globale”. |
| S-02 | Clear/reset | PASS | Clear controllato mantiene focus e svuota la query. |
| S-03 | Combinazioni | PASS | Query con trim, Unicode e caratteri speciali usa filtro locale. |
| S-04 | Empty | PASS | Query vuota mostra prompt, senza recent search inventate. |
| S-05 | Selected | PASS | Risultato selezionato via click/tap o Enter apre route reale. |
| S-06 | Privacy | PASS | Nessuna query viene inviata o loggata a servizi esterni. |
| S-07 | Disponibilità | PASS | La ricerca resta locale e disponibile offline. |

## Form

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Campi | PASS | Input type search, label, placeholder e controlled value passano. |
| F-02 | Mobile | PASS | Campo full-screen riceve focus ed è usabile a 320 px. |
| F-03 | Errori | N/A | N/A: non applicabile, il filtro sincrono locale non espone errori. |
| F-04 | CTA | PASS | Clear e close hanno label e target >=44 px. |
| F-05 | Overlay | PASS | Dialog ha trap Tab, Escape, focus iniziale e focus return. |
| F-06 | Loading | N/A | N/A: non applicabile, non esistono operazioni asincrone. |
| F-07 | Layout | PASS | Input e risultati reflowano senza clipping o overflow. |
| F-08 | Dati | PASS | I risultati usano proiezioni reali e non scrivono dati. |

## Stati

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading | N/A | N/A: non applicabile, ricerca locale sincrona senza loading reale. |
| B-02 | Empty | PASS | Query vuota è distinta da no-results e mantiene il campo. |
| B-03 | Error | N/A | N/A: non applicabile, nessun errore realistico nello strato corrente. |
| B-04 | Offline | PASS | Dati locali restano ricercabili senza rete. |
| B-05 | Successo | PASS | Selezione chiude ricerca e raggiunge destinazione reale. |
| B-06 | Disabled | PASS | Nessun controllo resta disabilitato impropriamente durante il filtro. |

## Accessibilita

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Nomi | PASS | Trigger, dialog, campo, clear, close e risultati hanno nomi accessibili. |
| A-02 | Keyboard | PASS | Tab, Shift+Tab, Arrow Up/Down, Enter ed Escape sono coperti. |
| A-03 | Contrasto | PASS | Focus, selected e testo secondario restano percepibili. |
| A-04 | Zoom | PASS | CDP 200% passa a 1024→512 e 1440→720 senza overflow. |
| A-05 | Annunci | PASS | Dialog, listbox, option e no-results hanno semantica leggibile. |
| A-06 | Dati | PASS | Nessuna informazione finanziaria viene resa solo tramite colore. |
| A-07 | Touch | PASS | Controlli fondamentali sono >=44 px nelle misure browser. |
| A-08 | Motion | PASS | Reduced motion non impedisce apertura, chiusura o selezione. |
| A-09 | WCAG | PASS | Focus trap/return, label, dialog e overflow soddisfano gate base. |

## Finanza

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Tipi | N/A | N/A: non applicabile, la ricerca non crea entrate o uscite. |
| N-02 | Transfer | N/A | N/A: non applicabile, trasferimenti restano fuori dalla mutation UI. |
| N-03 | Dati | PASS | Risultati e destinazioni usano view model e route reali. |
| N-04 | Riconducibilita | PASS | Ogni risultato deriva da un’entità già supportata. |
| N-05 | Precisione | N/A | N/A: non applicabile, la ricerca non calcola né formatta importi nuovi. |
| N-06 | Protezioni | PASS | Selezione non bypassa command layer o conferme finanziarie. |
| N-07 | Locale | PASS | Terminologia e filtro rispettano locale italiano e dati locali. |
| N-08 | Dominio | PASS | Nessun contratto dominio, repository o persistenza è stato cambiato. |

## Performance

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Risposta | PASS | Digitazione, clear e selezione rispondono nei flussi E2E. |
| Q-02 | Dataset | PASS | Risultati limitati a 8 senza duplicare il dataset sorgente. |
| Q-03 | Overlay | PASS | Apertura, chiusura, resize e riapertura restano stabili. |
| Q-04 | Proporzione | PASS | Nessuna dipendenza o virtualizzazione prematura è stata aggiunta. |
| Q-05 | Error/offline | PASS | Local-first resta operativo senza rete o log sensibili. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
