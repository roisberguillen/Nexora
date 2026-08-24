# 12.5.C3.1 — App Shell + Navigation Mobile/Desktop audit

Framework: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Manifest: `nexora-ui-ux-mobile-desktop/v2`
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Surface: App Shell + Navigation
Schermata: App Shell + Navigation
Route: `shell` e hash routes reali
Routes: `shell`, hash routes reali; ricerca globale solo trigger/affordance
Task/Fase: 12.5.C3.1
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-08-24
Revisore: Codex — UI/UX + QA
Result: `SCREEN_AUDIT_PASS`
Esito: UI_REVIEW_PASS
Flusso principale: ingresso shell → navigazione → overlay → ritorno focus
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom; keyboard; touch >=44 px

## Scope e componenti

Verificati `App`, `AppShell`, `MobileHeader`, `MobileBottomNavigation`, `QuickActionSheet`,
`SidebarNavigation`, `TopHeader`, `NavIcon`, hash routing, active route, overlay/backdrop, scroll
lock e focus management. La ricerca globale è stata verificata soltanto come trigger/input
accessibile e non come audit funzionale C3.2. Movimenti resta congelata con
`TRANSACTIONS_GATE_PASS`.

## Viewport

| Viewport | Esito | Evidence |
| ---: | --- | --- |
| 320 px | PASS | `test/e2e/app-shell.spec.ts`, overflow + axe + mobile nav |
| 375 px | PASS | `test/e2e/app-shell.spec.ts`, overflow + axe + mobile nav |
| 390 px | PASS | shell baseline e `c3-shell-audit.spec.ts`, drawer/route/resize |
| 768 px | PASS | shell baseline, mobile navigation e live resize |
| 1024 px | PASS | shell baseline, sidebar/collapse e zoom 200% |
| 1440 px | PASS | shell baseline, sidebar/collapse/offline e zoom 200% |
| Zoom 200% | PASS | CDP `Emulation.setDeviceMetricsOverride`, 1024→512 e 1440→720 CSS px |

## Mobile

PASS. Header, safe-area padding, profilo/notifiche, bottom navigation, Home/Movimenti/Analisi/
Profilo, CTA `+`, sheet, touch target e active route sono raggiungibili senza overflow. La bottom
navigation resta separata dal contenuto tramite padding inferiore; la quick action usa safe-area
bottom e focus trap. Testati anche 320/375/390 e il ritorno da resize.

## Tablet

PASS. A 768 px la shell passa intenzionalmente a header mobile e bottom navigation, senza sidebar
visibile duplicata. Il breakpoint intermedio 800 px mantiene il drawer navigabile con trigger,
backdrop, focus iniziale e chiusura. Nessun overflow o layout ibrido incoerente.

## Desktop

PASS. A 1024 e 1440 px sidebar, top header, ricerca-trigger, active state, collapse/expand,
etichette, focus e spazio contenuto sono utilizzabili. La sidebar non copre il workspace e la
density resta coerente con Stitch/design tokens. Nessuna funzione shell mobile necessaria è persa.

## Funzionalità e navigazione

PASS: apertura/chiusura drawer, Escape, backdrop, quick action, destinazione reale “Aggiungi nuovo
movimento”, route `#transactions`, browser back/forward, refresh/direct shell route, active route,
resize live `800→390→1440→768→320`, sidebar collapse e ricerca trigger/accessibility name.

## Accessibilità

PASS. Axe non rileva violazioni nei flussi browser. Icon button e landmark hanno nomi accessibili;
`aria-current` comunica la route attiva; focus visibile, focus iniziale del drawer, focus trap,
focus return su Escape/chiusura, keyboard Tab/Shift+Tab/Enter/Escape e touch target sono coperti.

## Rilievi iniziali e correzioni

### P0

Nessuno.

### P1

- **Risolto:** drawer navigation senza focus return al trigger dopo Escape/chiusura e senza trap
  Tab. Causa: `AppShell` chiudeva il pannello senza gestire il ciclo focus. Correzione in
  `packages/ui/src/AppShell.tsx`, con ref del trigger/pannello, focus iniziale, trap e return;
  ref inoltrati da `TopHeader.tsx` e `SidebarNavigation.tsx`.

### P2

Nessuno bloccante o lasciato aperto.

## Divergenze intenzionali

- La navigazione mobile usa header + bottom navigation fino a 768 px; il drawer è disponibile
  nella fascia intermedia in cui il top header espone il menu. È coerente con il piano mobile e
  evita sidebar e bottom navigation simultanee.
- La ricerca completa resta C3.2; C3.1 verifica solo il trigger e la semantica del campo.

## Test ed evidence

- `pnpm exec vitest run packages/ui/src/AppShell.test.tsx`: 5/5 PASS.
- `pnpm exec playwright test test/e2e/c3-shell-audit.spec.ts`: 3 PASS, 9 skip intenzionali per
  progetti non applicabili; coperti drawer/focus/route/resize, axe e zoom 200% su 1024/1440.
- `pnpm exec playwright test test/e2e/app-shell.spec.ts`: 7 PASS, 5 skip offline intenzionali;
  sei viewport 320/375/390/768/1024/1440, axe, overflow e offline 1440.
- `pnpm verify`: PASS — 136 file, 571 test PASS, 1 file skipped e 4 skip documentati; build PASS
  con advisory preesistente sui chunk >500 kB.
- `pnpm manifest:check`, `pnpm codex:validate`, `pnpm test:ui-ux`, `pnpm quality:ui-ux` e
  `pnpm format:check`: PASS dopo gli aggiornamenti documentali.

## Conclusione e freeze

`SCREEN_AUDIT_PASS`. P0=0, P1=0; mobile, tablet, desktop, zoom, tastiera, focus, safe area,
touch, stati e browser evidence verificati. App Shell + Navigation è congelata per C3: modifiche
successive solo per regressione dimostrata, problema cross-screen, P0/P1, accessibilità, sicurezza
o correttezza funzionale.

## Universale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Gerarchia | PASS | Header, nav, contenuto e CTA hanno ordine verificato. |
| U-02 | CTA | PASS | Menu, quick action e azioni distruttive sono distinguibili. |
| U-03 | Flusso | PASS | Route hash, rendering, back/forward e ritorno verificati. |
| U-04 | Invarianti | PASS | La shell non modifica logica finanziaria o persistenza. |
| U-05 | Robustezza | PASS | Overflow, focus, touch e doppio submit shell controllati. |

## Mobile

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px | PASS | Browser shell e axe passano senza overflow a 320 px. |
| M-02 | 375 px | PASS | Header, bottom nav e CTA passano a 375 px. |
| M-03 | 390 px | PASS | Drawer, route, resize e mobile hierarchy passano. |
| M-04 | Safe area | PASS | Header, bottom nav e sheet usano inset e padding dedicati. |
| M-05 | Touch | PASS | Controlli shell hanno target minimo verificato. |
| M-06 | Hover | PASS | Navigazione e CTA non dipendono dal solo hover. |
| M-07 | Tastiera | PASS | Tab, Shift+Tab, Enter ed Escape sono verificati. |
| M-08 | Testi | PASS | Titoli, label e navigazione restano leggibili sui viewport stretti. |
| M-09 | Variante | PASS | Mobile usa header/bottom nav, non desktop compresso. |

## Tablet

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px | PASS | Transizione mobile a 768 px senza overflow. |
| T-02 | Reflow | PASS | Resize live 800→390→1440→768→320 passa. |
| T-03 | Touch | PASS | Bottom nav e quick action restano azionabili. |
| T-04 | Navigazione | PASS | Nessuna sidebar/bottom nav duplicata a 768 px. |

## Desktop

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px | PASS | Sidebar e top header restano utilizzabili. |
| D-02 | 1440 px | PASS | Spazio, densità e sidebar seguono il riferimento. |
| D-03 | Dati | PASS | Ricerca trigger, label, pannelli e importi non sono coperti. |
| D-04 | Stati | PASS | Focus, selected, pressed e disabled hanno segnali visibili. |
| D-05 | Pannelli | PASS | Drawer/backdrop e quick action non si sovrappongono impropriamente. |
| D-06 | Layout | PASS | Desktop mantiene la composizione desktop approvata. |

## Visuale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Gerarchia | PASS | Spacing e densità sono coerenti con Stitch e token. |
| V-02 | Token | PASS | Colori, font, radius e icone condivisi sono preservati. |
| V-03 | Primitive | PASS | AppShell e primitive UI condivise sono riusate. |
| V-04 | Stati | PASS | Active, focus, pressed e disabled non dipendono solo dal colore. |
| V-05 | Contrasto | PASS | Axe e contrasto shell passano nei flussi browser. |
| V-06 | Motion | PASS | Reduced motion e transizioni non nascondono informazione. |

## Ricerca

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Search | PASS | Trigger/input ricerca ha label accessibile verificata. |
| S-02 | Clear/reset | N/A | Non applicabile: audit completo ricerca globale riservato a C3.2. |
| S-03 | Combinazioni | N/A | Non applicabile: filtri e risultati sono fuori scope C3.1. |
| S-04 | Empty | N/A | Non applicabile: empty search sarà verificato in C3.2. |
| S-05 | Selected | PASS | Trigger resta raggiungibile e nominato nella top bar. |
| S-06 | Privacy | PASS | La shell espone solo risultati locali già proiettati. |
| S-07 | Disponibilità | PASS | La ricerca non introduce regressioni shell evidenti. |

## Form

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Campi | N/A | Nessun form di feature è auditato in C3.1. |
| F-02 | Mobile | N/A | Non applicabile: form feature-specifici appartengono alle fasi successive. |
| F-03 | Errori | N/A | Non applicabile: errori di form non sono superficie shell. |
| F-04 | CTA | PASS | Quick action e chiusura overlay hanno CTA distinguibili. |
| F-05 | Overlay | PASS | Drawer e sheet hanno trap, Escape e focus return. |
| F-06 | Loading | N/A | Nessuna mutazione form appartiene alla shell. |
| F-07 | Layout | PASS | Overlay shell non copre CTA o contenuto verificato. |
| F-08 | Dati | N/A | Nessun dato monetario viene editato dalla shell. |

## Stati

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading | PASS | Startup lascia la shell utilizzabile quando pronta. |
| B-02 | Empty | PASS | Dashboard vuota mantiene shell e navigazione accessibili. |
| B-03 | Error | PASS | Error boundary non rompe i landmark shell verificati. |
| B-04 | Offline | PASS | E2E offline 1440 mantiene la build consultabile. |
| B-05 | Successo | PASS | Cambio route e chiusura overlay confermano il contesto. |
| B-06 | Disabled | PASS | Stati non applicabili alla shell non nascondono funzioni. |

## Accessibilita

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Nomi | PASS | Icon button, nav e landmark hanno accessible name. |
| A-02 | Keyboard | PASS | Keyboard-only drawer, sidebar collapse e quick action passano. |
| A-03 | Contrasto | PASS | Axe e stati visuali shell passano nei sei viewport. |
| A-04 | Zoom | PASS | CDP zoom 200% passa su 1024 e 1440 fisici. |
| A-05 | Annunci | PASS | Expanded, current e dialog semantics sono presenti. |
| A-06 | Dati | PASS | La shell non presenta grafici o dati complessi autonomi. |
| A-07 | Touch | PASS | Target touch shell e bottom nav sono verificati. |
| A-08 | Motion | PASS | Reduced motion è rispettato dai token CSS esistenti. |
| A-09 | WCAG | PASS | Focus trap/return, dialog e landmark rispettano il gate base. |

## Finanza

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Tipi | N/A | Non applicabile: la shell non crea entrate, uscite o trasferimenti. |
| N-02 | Transfer | N/A | Non applicabile: trasferimenti nella superficie Movimenti congelata. |
| N-03 | Dati | PASS | Le destinazioni sono route reali e non alterano view model. |
| N-04 | Riconducibilita | PASS | La shell usa contenuto/risultati già proiettati. |
| N-05 | Precisione | PASS | Nessun importo viene trasformato o persistito. |
| N-06 | Protezioni | PASS | Quick action porta al flusso reale senza bypass. |
| N-07 | Locale | PASS | Terminologia e navigazione UI italiana sono preservate. |
| N-08 | Dominio | PASS | Nessuna correzione dominio è stata introdotta. |

## Performance

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Risposta | PASS | Interazioni shell browser rispondono nei flussi E2E. |
| Q-02 | Dataset | PASS | La shell non duplica dataset o render di feature. |
| Q-03 | Overlay | PASS | Drawer e quick action aprono/chiudono stabilmente. |
| Q-04 | Proporzione | PASS | Nessun asset o dipendenza nuova introdotta. |
| Q-05 | Error/offline | PASS | Offline shell resta consultabile con feedback coerente. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
