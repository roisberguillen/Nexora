# Test evidence

## 12.5.C3.13 — Tags Mobile/Desktop audit — PASS — 2026-09-01

- Browser: Chromium headed su `#tags` con matrice 320/375/390/768/1024/1440; lista/editor, empty,
  create, rename, archive, merge/deduplica, overflow e axe verificati. Zoom 200% desktop PASS.
- Cross-screen: il flusso Tags → Movimenti apre “Altri dettagli”, associa più tag e salva senza perdita;
  rimozione/merge preservano le transazioni e la relazione resta basata su ID.
- Correzioni: unicità nomi case-insensitive in InMemory, IndexedDB e SQLite; UI Tags con guardia anti-doppio-submit
  e feedback `Salvataggio…`; E2E aggiornato al percorso reale del selettore Tag.
- Test mirati: tag commands + IndexedDB + SQLite `82 passed`; E2E Tags `19 passed, 5 skipped` (skip solo zoom
  non applicabile ai progetti non desktop); build PASS con advisory chunk-size preesistente.
- Integrità: join composta `transaction_id + tag_id`, duplicate relation bloccata, rename/merge per ID,
  delete usato protetto, remove globale senza cancellazione di Transactions, XSS renderizzato come testo.
- P0/P1/P2 aperti: 0/0/0. Risultato `SCREEN_AUDIT_PASS`; Tags FROZEN; prossimo C3.14 Import.

## 12.5.C3.10 — Analytics Mobile/Desktop audit — BLOCKED — 2026-08-30

- Browser: Chrome headed su `#analytics` a 390/1440 px; resize metrici 320/375/390/768/1024/1440;
  nessun overflow e reflow responsive PASS.
- Verificati KPI previsione/confronto, trend, tabella accessibile, trasferimenti e annullati esclusi;
  la pagina non espone periodo, filtri, categorie/split o filtered-empty richiesti dal brief.
- Rilievi P1: `AN-P1-01` scope Analytics incompleto; `AN-P1-02` conversione bigint→Number nel meter.
- Test mirati: AnalyticsPage + monthlyTrends `2/2 PASS`; E2E superfici esistenti PASS; nessuna modifica
  applicativa effettuata durante questo audit.
- Esito: `SCREEN_AUDIT_BLOCKED`; C3.10 resta corrente, C3.11 non iniziata.

## 12.5.C3.9 — Investimenti Mobile/Desktop audit — PASS — 2026-08-30

- Chiusura: `SCREEN_AUDIT_PASS`; Investimenti congelata per C3, prossimo task C3.10 Analisi.
- Browser: Chrome headed su `#investments` a 390/1440 px; resize metrici 320/375/390/768/1024/1440;
  nessun overflow, mobile monocolonna, editor desktop full-width.
- Funzionalità: empty, create, edit, delete, error, saving/double-submit e local-first verificati;
  il dettaglio operativo è rappresentato dalla card/lista e dal form di modifica.
- Finanza: Money/bigint, segno positivo/zero/negativo, rendimento estremo e capitale zero; niente
  somma FX falsa; gli investimenti restano esclusi da Disponibilità attuale Dashboard.
- Test mirati: InvestmentsPage + InvestmentPosition `10/10 PASS`; E2E Investimenti `6 PASS`.
- Gate: format, build e verifiche browser PASS; suite completa `595 PASS / 4 skip`.
- P0/P1/P2: nessuno aperto. Distribuzione grafica e dettaglio route separati sono N/A perché assenti
  dal modello corrente; nessuna metrica inventata.

## 12.5.C3.8 — Prestiti Mobile/Desktop audit — PASS — 2026-08-30

- Chiusura: `SCREEN_AUDIT_PASS`; Prestiti congelata per C3, prossimo task C3.9 Investimenti.
- Browser: Chrome headed su `#loans` a 390/1440 px; Playwright sui viewport 320/375/390/768/1024/1440;
  empty, lista, dettaglio, form, CRUD e overflow verificati.
- Correzioni: azioni card mobile a capo entro 320 px; doppio submit del form protetto.
- Test mirati: LoansPage + Loan domain `6/6 PASS`; E2E Loans `6 PASS`; suite completa `590 PASS / 4 skip`.
- Gate: lint, typecheck, test, build e codex validate PASS; advisory preesistente sui chunk oltre 500 kB.
- P0/P1/P2: nessuno aperto.

## Global Search desktop clear focus regression — FIXED — 2026-08-25

- Routing: `ui_component`, profilo `STANDARD`, rischio dati `low`; fix scoped to `TopHeader` clear focus.
- Correzione: il pulsante `Cancella ricerca` desktop ripristina il focus sull’input tramite ref dopo aver
  svuotato la query; il comportamento mobile resta invariato.
- Test mirati: `AppShell.test.tsx` + `GlobalSearch.test.ts` 10/10 PASS; `global-search.spec.ts` 15 PASS,
  9 skip intenzionali; verifica manuale nel Chrome reale confermata.
- Esito: P1 GS-P1-03 chiuso; Global Search resta `SCREEN_AUDIT_PASS`, senza P0/P1 aperti.

## Rendered browser review gate — 2026-08-25

- Extended the existing v2 screen review validator and template with separate Code review,
  Automated browser verification and Visual browser verification fields.
- Visual evidence requires rendered route/surface, pertinent interactions, required viewports,
  zoom 200%, concrete observations and screenshot evidence or an explicit N/A rationale.
- `pnpm test:ui-ux`: 8/8 passed, including missing visual review, missing evidence, missing viewport,
  failed visual status and backend-only gate cases. `pnpm codex:validate` passed.
- No application screen, domain, persistence or financial behavior was changed.

## 12.5.C3.4 — Accounts Mobile/Desktop audit — COMPLETE — 2026-08-24

- Routing: `localized_bug`, profilo `STANDARD`, rischio dati `low`; C3.3 COMPLETE/PASS and C3.4 NEXT.
- Audit iniziale: lista/editor passavano ma azioni account avevano target 32/40 px; Elimina era mostrato anche
  su conti con attività. Detail route e filtro Movimenti non sono esposti nel codice corrente e sono stati
  documentati N/A senza introdurre una seconda implementazione.
- Correzioni: `AccountsPage.tsx` mostra Elimina solo per conti senza transazioni/transfer; `page.css` porta
  azioni e close editor a 44 px minimi.
- Viewport browser: `c3-accounts-audit.spec.ts` PASS su 320, 375, 390, 768, 1024 e 1440; lista/editor,
  create, valid delete visibility, axe, touch target e overflow verificati.
- Zoom 200%: PASS con CDP su 1024→512 e 1440→720 CSS px; editor, CTA, overflow e axe PASS.
- Funzionalità: create/update/archive/reactivate/empty/delete-empty, validation, success/error, double-submit
  and local persistence paths remain covered by existing unit/E2E tests.
- Test mirati: accountCommands/buildAccountsViewModel 5/5 PASS; C3.4 browser 14 PASS, 4 skip intenzionali;
  existing accounts browser 13 PASS, 5 skip intenzionali; `pnpm build` PASS with advisory chunk-size preexisting.
- Esito: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Conti congelati C3; C3.5 è NEXT.

## 12.5.C3.3 — Dashboard/Home Mobile/Desktop audit — COMPLETE — 2026-08-24

- Routing: `localized_bug`, profilo `STANDARD`, rischio dati `low`; Dashboard `#overview` audit
  avviato dopo C3.2 COMPLETE, senza iniziare C3.4 e senza nuove route.
- Audit iniziale: Dashboard funzionante su mobile ma axe desktop rilevava un P1 ARIA nella ricerca
  globale condivisa dalla shell; nessun P0/P1 Dashboard-specifico o difetto finanziario aperto.
- Correzione: `packages/ui/src/TopHeader.tsx` dichiara il campo ricerca come `combobox`, rendendo
  coerenti `aria-expanded`, `aria-controls`, `listbox` e `option`; nessun cambio di logica o dati.
- Stati e finanza: empty seed esplicito, metriche reali, transfer esclusi dai flussi e collassati
  in una riga neutrale, annullati esclusi dai saldi, valute diverse non convertite implicitamente.
- Viewport browser: `test/e2e/c3-dashboard-audit.spec.ts` e `dashboard.spec.ts` passano su 320,
  375, 390, 768, 1024 e 1440; overflow e axe PASS, CTA demo >=44 px.
- Zoom 200%: PASS con CDP su 1024→512 e 1440→720 CSS px; Dashboard e shell restano utilizzabili.
- Keyboard/touch: Enter sulla CTA dello stato vuoto PASS; target touch della CTA misurato >=44 px.
- Test mirati: `buildDashboardViewModel.test.ts` 5/5 PASS; `pnpm build` PASS con advisory chunk-size
  preesistente. Browser combinato: 19 PASS e 5 skip intenzionali per viewport non applicabili.
- Esito: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Dashboard/Home congelata C3; C3.4 è NEXT.

## 12.5.C3.2 — Global Search Mobile/Desktop audit — COMPLETE — 2026-08-24

- Routing: `localized_bug`, profilo `STANDARD`, rischio dati `low`; C3.1 congelata e C3.2
  avviata come superficie `#search`, senza nuove categorie o route.
- Audit iniziale: P1 ricerca mobile assente sotto 768 px; P1 keyboard/focus result incompleto;
  clear, empty query, no-results e touch target registrati come correzioni della stessa superficie.
- Correzioni: trigger mobile e dialog full-screen locale; focus automatico, Escape, focus return,
  scroll lock, clear, listbox/option, Arrow Up/Down, Enter, Tab trap e controlled query. Desktop
  mantiene TopHeader e stesso `filterGlobalSearchResults`/`buildGlobalSearchResults`.
- Funzionalità: conti, categorie, tag, movimenti, prestiti e investimenti; destinazioni hash reali;
  nessun dominio, persistenza, API, indice, servizio online o nuova categoria introdotti.
- Viewport browser: 320, 375, 390, 768, 1024 e 1440 PASS per apertura, query, risultati,
  navigazione, no-results, clear ed Escape. Target trigger/clear/close/risultati >=44 px.
- Keyboard/resize: 768 PASS con selezione risultato via Enter, target touch e resize live
  `768→390→320→1440`; query preservata e nessun overflow/overlay duplicato.
- Zoom 200%: PASS con CDP su 1024→512 e 1440→720 CSS px; scrollWidth <= clientWidth.
- Stati: empty query e no-results PASS; loading/error N/A motivati perché la proiezione è sincrona
  e locale; offline coerente con local-first, senza dipendenze di rete.
- Test mirati: `GlobalSearch.test.ts` + `AppShell.test.tsx` 9/9 PASS; UI/web typecheck PASS.
- Browser: `test/e2e/global-search.spec.ts` 15 PASS, 9 skip intenzionali limitati a test aggiuntivi
  non applicabili agli altri viewport; build PASS con advisory chunk-size preesistente.
- Esito: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Global Search congelata C3; C3.3 è NEXT.

## 12.5.C3.1 — App Shell + Navigation Mobile/Desktop audit — COMPLETE — 2026-08-24

- Routing: `ui_component`, profilo `CRITICAL`, rischio dati `medium`; App Shell/navigation scope
  identificato senza audit della ricerca completa e con Movimenti congelata.
- Baseline: component shell 4/4; browser shell 7 PASS, 5 skip offline intenzionali su 320/375/
  390/768/1024/1440; axe e overflow PASS.
- Rilievo P1 risolto: drawer aperto senza focus return e focus trap; corretti solo AppShell,
  SidebarNavigation, TopHeader e test UI. Nessuna modifica a dominio, persistenza o Movimenti.
- Test mirati post-fix: `packages/ui/src/AppShell.test.tsx` 5/5 PASS.
- Browser C3.1: `test/e2e/c3-shell-audit.spec.ts` 3 PASS, 9 skip intenzionali; drawer/focus,
  Escape/return, route + browser back/forward, live resize 800→390→1440→768→320, axe e
  overflow; zoom 200% CDP su 1024→512 e 1440→720 PASS.
- Gate finali: `pnpm verify` PASS — 136 file, 571 test PASS, 1 file skipped e 4 skip documentati;
  build PASS con advisory chunk-size preesistente. `format:check`, `manifest:check`,
  `codex:validate`, `test:ui-ux` e `quality:ui-ux` PASS.
- Esito: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. App Shell + Navigation congelata C3.

## 12.5.C3.0 — Full Mobile/Desktop screen audit preparation — COMPLETE — 2026-08-24

- Routing: `pnpm codex:route --task "12.5.C3.0 ..."` — PASS; documentation, ECONOMY, low data risk.
- Gate di ingresso verificati: C2.9 COMPLETE, `TRANSACTIONS_GATE_PASS`, Movimenti congelata,
  P0/P1 aperti assenti, branch `codex/phase-12-5-0-checkpoint`.
- Documenti analizzati: stato corrente, roadmap, evidence, review finale C2.9, repository map,
  MOCKUP_INTEGRATION, DESIGN, STITCH_UI_REFERENCE, STITCH_SCREEN_MATRIX, MOBILE_UI_IMPLEMENTATION_PLAN,
  PRIMARY_FLOWS, manifest UI/UX, template v2 e agent guidance UI/UX/QA/security.
- Repository reale confrontato: 34 superfici/stati inventariati contro la routing hash di `App.tsx`;
  nessuna route artificiale introdotta. Allocazioni restano in `#recurring`; startup/recovery in
  `bootstrap`; Movimenti è regression review C3.5 su gate C2 esistente.
- Framework e checklist: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`; template standard:
  `.codex/templates/c3-screen-audit.md`; tracking: `.codex/state/ui-screen-review-matrix.md`.
- Coperti: mobile-first 320/375/390, tablet 768, desktop 1024/1440, zoom 200%, keyboard/focus,
  safe area, touch >=44 px, responsive, funzionalità, stati, edge case, accessibilità, severity,
  browser evidence, PASS/BLOCKED e freeze rule.
- Nessun codice applicativo, CSS/SCSS, dominio, database, repository, import, backup, Tauri o test
  funzionale modificato.
- Validazioni C3.0: `pnpm manifest:check` PASS (`PROJECT_MANIFEST.json is current`),
  `pnpm codex:validate` PASS (17 routes), `pnpm test:ui-ux` PASS (6/6),
  `pnpm quality:ui-ux` PASS (nessuna modifica UI staged) e `pnpm format:check` PASS.

## 12.5.C2.9 — Final Transactions Gate — COMPLETE — 2026-08-24

- Review finale: `.codex/reviews/ui-ux/2026-08-24-movimenti-c2-9-final-gate.md` —
  `TRANSACTIONS_GATE_PASS`; freeze della superficie Movimenti consentito.
- Funzionalità: lista, grouping, dettaglio, ricerca/clear, filtri/applica/reset, Entrata, Uscita,
  Transfer, read-only transfer, split/tag, annullamento, cestino/restore e conferme PASS.
- Stati e accessibilità: loading, empty, filtered-empty, error, offline, success, disabled,
  keyboard, focus, dialog/sheet, accessible names, axe, contrasto e touch target PASS.
- Invarianti: Money, minor units `bigint`, it-IT, transfer atomici a due gambe, esclusione dai KPI,
  command layer reale e nessuna scrittura UI diretta agli adapter PASS.
- Test mirati Movimenti: 8 file, 38/38 passati, 0 skip. E2E: 60/60 passati su 320/375/390/768/
  1024/1440. Zoom 200% C2.7-F1 preservato e riconfermato come regression PASS.
- Gate globali: doctor, format, lint, typecheck, test (136 file, 570 test, 1 file skipped e 4 skip
  documentati), build, manifest, codex e verify PASS. Build: solo advisory preesistente chunk-size.
- Skip: 4 globali documentati, nessuno Movimenti; P0/P1/P2 aperti: nessuno.
- C2.3 riallineata a COMPLETE sulla base delle evidence successive C2.7/C2.8; nessun test inventato.
- Stato finale: C2 COMPLETE, Movimenti congelati; prossimo task C3.0. Non iniziare C3.0 in C2.9.

## 12.5.C2.8 — Transactions UI states, accessibility and hardening — COMPLETE — 2026-08-24

- Review: `.codex/reviews/ui-ux/2026-08-24-movimenti-c2-8.md` — `UI_HARDENING_PASS`.
- Correzioni: guardia sincrona anti-doppio-submit su tutte le mutazioni Movimenti, `aria-busy` sul
  form e messaggi leggibili per importi non validi e split non bilanciati; nessuna modifica a dominio,
  repository, API, Money o regole sui trasferimenti.
- Stati verificati: loading/disabled, empty ledger, filtered-empty, populated, error, offline locale,
  success, pressed, focus e dialog/sheet. Errori preservano l’editor senza stack trace.
- Accessibilità: accessible names, `role=alert`/`role=status`, keyboard Escape/Enter, focus trap e
  focus return verificati; axe verde nei flussi E2E; target touch >=44 px; zoom 200% C2.7 preservato.
- Edge case: double-submit, importi invalidi/zero/negativi/estremi, separatori italiani, Unicode,
  testi lunghi, split/tag e trasferimenti read-only verificati senza nuovi command di dominio.
- Responsive: E2E Movimenti 60/60 sui viewport 320, 375, 390, 768, 1024 e 1440 px; nessun overflow.
- Test: component mirati 24/24; suite completa 136 file, 570 test, 1 file skipped e 4 skip documentati;
  `format:check`, lint, typecheck, build, `verify`, `quality:ui-ux`, manifest e orchestrator PASS.
- P0 aperti: nessuno. P1 aperti: nessuno. P2 aperti: nessuno. Stato: C2.8 COMPLETE; prossimo C2.9.

## 12.5.C2.7-F2 — Global format check and C2.7 closure — COMPLETE — 2026-08-24

- Comando iniziale: `pnpm format:check` — PASS, exit code 0, nessun file fuori formato; non sono
  state necessarie correzioni e quindi non ci sono file classificati A/B/C da formattare.
- La formattazione globale era già stata normalizzata nel worktree precedente; F2 ha verificato il
  risultato senza riscritture indiscriminate e senza modifiche funzionali.
- Regression gate: lint PASS; typecheck PASS; test PASS (136 file, 567 test, 1 file skipped e 4
  skip documentati); build PASS; manifest:check PASS; codex:validate PASS; verify PASS.
- Evidence preservate: component test Movimenti 20/20, E2E Movimenti 60/60, viewport 320/375/390/
  768/1024/1440, zoom 200% PASS, A-04 PASS, P0/P1/P2 aperti: nessuno.
- Stato finale: review `UI_REVIEW_PASS`; C2.7 `COMPLETE`; prossimo task C2.8. Nessun codice
  applicativo, dominio, API, database o regola finanziaria modificato in F2.

## 12.5.C2.7-F1 — Zoom browser 200% — COMPLETE — 2026-08-24

- Metodo: sessione Chromium headed controllata con CDP `Emulation.setDeviceMetricsOverride`,
  finestra fisica 1024 e 1440 px, CSS viewport rispettivamente 512 e 720 px, `deviceScaleFactor: 2`
  e `devicePixelRatio≈2`; non è stata usata una trasformazione CSS né un semplice test a 320 px.
- Flussi verificati in entrambi i contesti: pagina Movimenti, ricerca/clear, filtri, apertura/applica,
  reset, Escape e focus return, lista/gruppi/importi, dettaglio/importo, nuovo movimento, Entrata,
  Uscita e Trasferimento.
- Risultati: 2/2 contesti verdi; `scrollWidth <= innerWidth` (497<=512 e 705<=720); nessuna CTA,
  label, overlay o controllo essenziale irraggiungibile; nessun difetto P0/P1/P2 trovato.
- Correzioni codice: nessuna necessaria.
- Regression: test Movimenti precedente 60/60; nessuna regressione introdotta.
- Stato P1: zoom 200% RISOLTO; `format:check` globale resta aperto per C2.7-F2.

## Fase 12.5.C2.6-R — Risoluzione blocker modifica Trasferimenti — COMPLETE — 2026-08-24

- Problema iniziale: la UI non disponeva di un contratto `onUpdateTransfer` e il ramo transfer poteva
  essere raggiunto con `editingId`, rischiando una falsa creazione.
- Decisione: i trasferimenti registrati sono intenzionalmente non modificabili; non è stato introdotto
  `updateTransfer`, né sono stati modificati dominio, Money, repository, schema o migration.
- Correzione: “Modifica” resta nascosta per i transfer nella lista; il dettaglio mobile/desktop è
  read-only; una guardia applicativa blocca `transfer + editingId` senza chiamare `onCreateTransfer`
  o `onUpdateManual`.
- File runtime/test: `apps/web/src/transactions/TransactionsPage.tsx`,
  `apps/web/src/transactions/TransactionList.test.tsx`,
  `apps/web/src/transactions/TransactionsPage.test.tsx`.
- Test mirati: 4 file, 25 test passati; E2E Movimenti precedente 60/60 su 320, 375, 390, 768, 1024,
  1440 px; coperti creazione/annullamento transfer, dettaglio, azioni, Entrata/Uscita e KPI.
- Gate completi da rieseguire dopo l’aggiornamento documentale: format, lint, typecheck, test, build,
  manifest, orchestrator e verify.

## Fase 12.5.C2.7 — Mobile Banking UX Movimenti — parziale — 2026-08-24

- Modificati esclusivamente `apps/web/src/transactions/TransactionsPage.tsx`,
  `apps/web/src/transactions/transactions.css`, il test componente Movimenti e
  `test/e2e/transactions.spec.ts`; nessuna modifica a dominio, Money, repository, persistenza o
  command layer.
- La ricerca mobile ora dispone di clear action; i quick filter sono scorribili; i filtri usano un
  bottom sheet accessibile con focus trap, Escape, focus return, safe area e reset; la CTA del nuovo
  movimento resta raggiungibile a 320 px.
- Test mirati: Vitest **20/20**; lint PASS; typecheck PASS; build PASS; E2E Movimenti **60/60** su
  320, 375, 390, 768, 1024 e 1440 px, inclusi trasferimento, Entrata/Uscita, ricerca, filtro sheet,
  focus/Escape, axe nei flussi esistenti e overflow.
- Gate globali verdi dopo normalizzazione Prettier repository-wide: `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test` (**136 file passati, 564 test passati, 1 file condizionalmente
  skipped e 4 skip documentati**), `pnpm build`, `pnpm manifest:check` e `pnpm codex:validate`.
  Anche `pnpm quality:ui-ux` e `pnpm test:ui-ux` sono verdi; il test UI/UX passa 6/6.
- La review schermata resta `UI_REVIEW_INCOMPLETE` soltanto perché manca la verifica browser
  dedicata dello zoom 200%; la fase non è stata marcata `COMPLETE`, né sono stati creati commit o
  push.

## UI/UX checklist governance consolidation — 2026-08-24

- Consolidated the existing UI/UX manifest into checklist v2 without adding a parallel skill.
  Screen reviews now require identified controls, per-control evidence, metadata, P0/P1/P2,
  320/375/390/768/1024/1440 px, 200% zoom, keyboard-only and touch >=44 px.
- Added the persistent screen matrix at `.codex/state/ui-screen-review-matrix.md`; every initial
  surface is `NOT_REVIEWED` and no surface was artificially marked `PASS`.
- Updated the validator, template, UI/UX agents, QA guidance, UI skill, router and finalizer gate.
  Legacy non-surface governance reports remain readable; real screen reports require v2.
- Tests: `pnpm test:ui-ux` passed 6/6; `pnpm codex:validate` passed; UI routing smoke returned
  `ui_component` with the expected responsive/accessibility tests.
- No application screen, financial domain, repository, persistence or command behavior changed.

Keep only the latest relevant evidence per completed phase.

## 12.5.C3.7 — Ricorrenze + Allocazioni Mobile/Desktop audit — PASS — 2026-08-30

- Chiusura: `SCREEN_AUDIT_PASS`; Ricorrenze + Allocazioni congelate per C3, prossimo task C3.8 Prestiti.
- Browser: Chrome headed su `#recurring` e Playwright sui viewport 320/375/390/768/1024/1440;
  stati vuoti, editor, liste, preview/conferma e overflow verificati. Zoom 200% PASS.
- Test mirati: 5 file, `28/28 PASS`; E2E Ricorrenze + Allocazioni `6 PASS`.
- Gate: lint, typecheck, test, build, codex validate e quality UI/UX PASS; suite completa
  `589 PASS / 4 skip`, 137 file passati e 1 skipped.
- Correzioni: overflow mobile, stati vuoti, preview origine/destinazione, doppio submit e
  validazione conto assente; invarianti transfer/idempotenza confermati.
- P0/P1/P2: nessuno aperto.

## 12.5.C3.6 — Budget Mobile/Desktop audit — PASS — 2026-08-30

- Chiusura: `SCREEN_AUDIT_PASS`; Budget congelata per C3, prossimo task C3.7 Recurring + Allocations.
- Browser: Chrome headed su `#budgets` e Playwright sui viewport 320/375/390/768/1024/1440;
  lista/editor, stato vuoto, periodo, CTA, card/progresso e overflow verificati. Zoom 200% PASS.
- Domain: soglie, propagazione mensile, macro/sottocategorie, split, trasferimenti e annullati
  verificati tramite `calculateBudgetProgress` e `resolveActiveBudgetsForPeriod`.
- Test mirati: 4 file, `13/13 PASS`; E2E Budget `7 PASS / 5 skip` intenzionali.
- Gate: format, lint, typecheck, test, build, manifest, codex validate e quality UI/UX PASS;
  suite completa `589 PASS / 4 skip`, 137 file passati e 1 skipped.
- P0/P1/P2: nessuno aperto; nessun file runtime modificato.

## Phase 12 closure review — 2026-08-14

- GitHub CI `31725944677` for `4ab136e` is green: frozen install, doctor, format, lint,
  workspace typecheck, unit/component/integration tests, production build, manifest and Chromium
  installation/E2E all completed successfully.
- Vitest: 128 files passed, 1 conditionally skipped; 504 tests passed, 4 benchmark skips, in
  135.05 s. Playwright: 198 passed, 90 documented skips, in 11.2 min. Skips avoid duplicate
  viewport executions, optional live Google consent and opt-in heavy recovery/performance flows;
  no Phase 12 critical flow is skipped everywhere.
- Local closure audit also passed `pnpm doctor`, `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm build`, `pnpm manifest:check` and `pnpm audit --prod` (no known
  vulnerabilities). No unresolved Phase 12 P0/P1 was found.

## Phase 12.E automated surface coverage — 2026-08-13

- Coverage audit: Budget, recurring rules, allocations, loans, investments, categories and tags
  already had command/domain and component coverage; existing browser flows cover the financial
  mutation paths. Analytics lacked component and E2E coverage, Journal lacked component and E2E
  coverage, and Notifications lacked component coverage.
- Added component coverage for Analytics (projected booked EUR data, income, expense, savings,
  forecast, comparison, accessible chart and empty fallback), Journal (empty state, financial
  summary, accessible 1–5 control, edit and isolated confirmed deletion), and Notifications
  (preference surface plus persisted local dismiss state and empty state).
- Added an end-to-end flow that seeds only the built-in synthetic ledger, reads Analytics, saves a
  Journal reflection, saves the notification threshold, and checks horizontal overflow. It passed
  at 320, 375, 390, 768, 1024 and 1440 CSS px: 6 passed, 0 failed, 0 skipped, 12.4 s. The only
  warnings were the runner's `NO_COLOR`/`FORCE_COLOR` environment warning.
- Focused Vitest: 3 files, 5 passed, 0 failed, 0 skipped, 3.62 s. Full `pnpm test` and the
  `pnpm verify` aggregate were started after format, lint and workspace typecheck had passed;
  local terminal worker output did not retain their final summary, so their counts are not claimed
  here pending a reproducible completed report.

## Phase 12.D local civil dates — 2026-08-13

- Classificazione: UTC resta per timestamp di audit, backup, logging e notifiche; i default di
  nuovi movimenti, valutazioni investimento e periodo Diario usano ora data civile `Europe/Rome`.
- `localCivilDate` / `localCivilMonth` usa `Intl.DateTimeFormat` centralizzato; 5 test coprono
  00:30, cambio mese/anno e transizioni di ora legale/solare senza dipendere dalla timezone CI.
- Typecheck web, lint e manifest check passati localmente.

## Phase 12.C investment CSV safety — 2026-08-13

- Rimosso il parser CSV locale non transazionale dalla superficie Investimenti: non esiste più
  assegnazione implicita a un conto, parsing con `split`, commit riga-per-riga o import parziale.
- L'analisi ha escluso il riuso diretto del framework Import: i batch correnti trattano solo
  transazioni, righe audit e undo correlato; estenderli a posizioni richiede una slice dedicata.
- Test UI mirati: 5 passati; typecheck web, lint e `pnpm manifest:check` passati.

## Phase 12.5 allocation plans — 2026-08-12

- CRUD, pause/resume and deletion confirmation retain executed transfers. Confirmed execution uses
  deterministic per-plan transfer identities and a persisted marker, covering retry after a
  sequential failure and concurrent confirmation without duplicate bundles.
- SQLite/OPFS, IndexedDB and InMemory adapter coverage verifies plan updates and removal; portable
  snapshots retain active plans and historic disabled plans with archived accounts. Financial reset
  clears plans without touching preferences.
- Focused domain/component/adapter/backup suites: 94 tests passed. Full unit suite, formatting,
  lint, typecheck, production build, manifest and orchestrator validation passed locally. The
  allocation E2E passed at 320, 375, 390, 768, 1024 and 1440 px.
- PR #7 and post-merge GitHub Actions `verify` on `main` (`3edeabb`) passed all official checks,
  including Linux Playwright.

## Phase 12.4 hierarchical budgets — 2026-08-11

- Domain selector covers macro descendants (including archived history), direct subcategories,
  exact split attribution without parent double count, excluded transaction kinds/statuses, Money
  residual and over-budget state. SQLite, IndexedDB and in-memory repositories reject duplicate
  period/scope budgets and provide a flat split read for the shared snapshot.
- Portable snapshot preserves budget scope and alert flags; reset and import retain their existing
  non-destructive contracts. The Notifications Center now uses the same selector, avoiding a
  divergent direct-transaction calculation.
- Targeted component/domain/backup/notification suites: 16/16 passed. Full unit suite: 117 files
  passed, 454 tests passed, 4 documented skips. Budget E2E passed on 320, 375, 390, 768, 1024 and
  1440 px; desktop 200% zoom passed with no horizontal overflow. `doctor`, format, lint,
  typecheck, production build, manifest check and orchestrator validation passed locally.
- PR #4 and the post-merge `main` pipeline run 31495233481 both passed the complete GitHub Actions
  workflow, including Linux Playwright.

## Phase 12.4 configurable budget thresholds correction — 2026-08-11

- Domain validation covers integer thresholds 1–100, strictly ordered pairs, update, and legacy
  budgets without configured alerts. SQLite migration v18 maps active legacy flags to 80/100,
  retains disabled alerts as absent thresholds, validates database writes, and rolls back without
  removing a budget.
- SQLite/OPFS, IndexedDB reopen (including a v16 record), InMemory, shared Tauri initialization,
  portable snapshot and local SQLite backup fixtures preserve configurable thresholds. The local
  Notifications Center emits deterministic first/second threshold records through its existing
  acknowledgement state.
- Targeted domain/component/persistence/backup/notification suites: 105/105 passed. `pnpm verify`,
  `pnpm doctor`, `pnpm manifest:check` and `pnpm codex:validate` passed. Budget E2E: 7 passed,
  5 expected skips on non-desktop zoom projects, across 320, 375, 390, 768, 1024 and 1440 px.

## Phase 11 live Google Drive closure and SQLite restore fix — 2026-08-08

- Root cause: the SQLite portable-snapshot replacement did not defer foreign keys, so a ledger
  containing self-referential account/category trees could reject the atomic replacement before
  the engine-level rollback.
- Targeted regression: SQLite repository and PortableBackupEngine suites, 33/33 passed; the new
  case replaces a ledger containing a virtual subaccount and confirms the replacement is atomic.
- Live drill: explicit Google consent, encrypted Drive upload, remote list, read-only
  checksum/schema verification, checkpointed restore and post-reload overview completed on the
  OPFS ledger. The token and passphrase remained volatile.
- `pnpm doctor`, `pnpm lint`, `pnpm typecheck`, full serial `pnpm test` and `pnpm build` passed.
  Full tests: 109 files passed, 394 tests passed, 4 documented skips. `pnpm codex:validate`
  passed with 17 routes.
- `test/e2e/google-drive-onboarding.spec.ts`: 5 passed at configured viewports, 5 account-consent
  cases skipped because the live-account E2E environment flag is intentionally absent; the live
  browser drill above supplies the authorized-account evidence.

## Phase 7 baseline — 2026-08-01

- `pnpm verify`: passed; 98 test files passed, 344 tests passed, documented skips only.
- Browser startup/persistence: OPFS, IndexedDB, orchestrator and 50 reload E2E passed.
- Native: `cargo check --locked`, release build, open/close/reopen and SQLite integrity `ok`.

## Orchestrator — 2026-08-02

- `pnpm codex:test`: 6/6 passed.
- `pnpm codex:validate`: 17 routes, 4 profiles and 8 skills valid.
- Verified structure, JSON-compatible YAML 1.2, route limits, escalation, CRITICAL checkpoint,
  agent limits, roadmap consistency and absence of operational legacy backup paths.
- `pnpm verify`: passed; 98 test files passed, 344 tests passed, 4 documented skips.
- System `quick_validate.py`: attempted but unavailable because its runtime lacks `PyYAML`; equivalent
  frontmatter, names, descriptions, placeholders and metadata are enforced by the offline validator.

## Phase 8 transfer-only imports — 2026-08-02

- Baseline import/export: 6 files and 15 tests passed.
- Transfer confirmation: 3 files and 9 targeted tests passed; web typecheck passed.
- `test/e2e/imports.spec.ts`: 6/6 passed at 320 and 1440 px after rebuilding `dist`.

## Phase 8 Excel serial dates — 2026-08-02

- Money Manager preview and dry-run: 2 files and 7 targeted tests passed.
- `@nexora/importers` strict TypeScript check passed.
- Covered a real XLSX numeric date cell, localized amount preservation and the invalid Excel
  serial day 60 review path.
- `pnpm codex:validate`: passed with 17 routes.
- `pnpm verify`: passed; 99 test files passed, 349 tests passed, 4 documented skips, production
  PWA build completed.

## Phase 8 raw source audit — 2026-08-02

- Importer preview, import command regressions and isolated audit round-trip: 3 files and 10 tests
  passed.
- `@nexora/importers` and `@nexora/web` strict TypeScript checks passed.
- Verified immutable original cells and simultaneous normalized values in persisted `rawJson`.
- `pnpm codex:validate`: passed with 17 routes.
- `pnpm verify`: passed; 100 test files passed, 350 tests passed, 4 documented skips and the
  production PWA build completed.

## Phase 8 mapping profiles and schema v14 — 2026-08-02

- Migration v13→v14 and rollback: existing batch preserved, nullable profile association verified.
- Migration catalog, domain, SQLite/IndexedDB adapter parity, portable backup and mapping profile
  validation: targeted suites passed; full workspace typecheck passed.
- Responsive import E2E saves and selects a reusable profile before atomic commit: 15/15 passed
  at 320, 375, 768, 1024 and 1440 px.
- `pnpm codex:validate`: passed with 17 routes.
- `pnpm verify`: passed; 102 test files passed, 354 tests passed, 4 documented skips and the
  production PWA build completed.

## Phase 8 generic CSV and schema v15 — 2026-08-02

- CSV parser, v14→v15 migration/rollback, catalog, SQLite/IndexedDB parity and backup compatibility:
  6 files and 76 targeted tests passed; full workspace typecheck passed.
- Covered semicolon/comma detection, quoted delimiters, escaped quotes, multiline fields, malformed
  input and exact source-cell retention.
- Import E2E including generic CSV: 20/20 passed at 320, 375, 768, 1024 and 1440 px.
- `pnpm codex:validate`: passed with 17 routes.
- `pnpm verify`: passed; 104 test files passed, 359 tests passed, 4 documented skips and the
  production PWA build completed.

## Phase 8 complete export and quality report — 2026-08-02

- Quality report, export helpers, portable snapshot and App integration targeted suites passed.
- Complete JSON download E2E: 5/5 passed at 320, 375, 768, 1024 and 1440 px; the test applies an
  account filter and verifies that the versioned snapshot still contains all ledger entities,
  relations and all 8 demo transactions.
- `pnpm codex:validate`: passed with 17 routes.
- `pnpm verify`: passed; 105 test files passed, 362 tests passed, 4 documented skips and the
  production PWA build completed.

## Phase 9 destination-independent Backup Engine — 2026-08-02

- Shared engine, encrypted envelope, portable snapshot and browser/Tauri adapter suites passed.
- Covered archive autoverification, wrong passphrase, tampering, future schema rejection,
  IndexedDB restore, IndexedDB→SQLite round-trip and verified rollback after a post-write failure.
- Package typechecks for `@nexora/database` and `@nexora/database-tauri` passed.
- `pnpm verify`: passed; 106 test files passed, 366 tests passed, 4 documented skips and the
  production PWA build completed.

## Phase 10 manual backup — 2026-08-02

- BackupPage, shared engine and browser/Tauri adapter suites: 4 files and 19 targeted tests passed.
- Covered read-only verification receipt, invalid passphrase/tamper error, explicit confirmation,
  cancellation and verification invalidation after file/passphrase changes.
- Manual backup browser E2E passed at 320, 375, 768, 1024 and 1440 px with axe and overflow checks;
  the 1440 flow downloaded, reselected and verified a real encrypted archive.
- OPFS backup/restore smoke passed against the live schema catalog; full E2E passed with 152 tests
  and 63 documented skips, including 100,000-record OPFS and IndexedDB checks.
- `pnpm doctor`, `pnpm codex:validate`, `pnpm codex:test` and `pnpm manifest:check`: passed.
- `pnpm verify`: passed; 106 test files passed, 370 tests passed, 4 documented skips and the
  production PWA build completed.

## Phase 11 Google Drive implementation — 2026-08-02

- Provider, OAuth, loader, configuration, BackupPage, history and total-reset suites: 7 files and
  34 targeted tests passed; strict web typecheck passed.
- Covered invalid metadata, size mismatch, expired/denied sessions, GET retry, non-retried POST,
  concurrent/denied/timed-out consent, checksum mismatch and explicit restore confirmation.
- Production build passed; backup UI E2E passed at 320, 375, 768, 1024 and 1440 px with axe and
  overflow checks (6 passed, 4 intentional duplicate round-trip skips).
- `pnpm codex:validate` and `pnpm codex:test`: passed; `pnpm verify`: 107 test files passed,
  1 skipped, 383 tests passed and 4 documented skips; production PWA build completed.
- Full `pnpm test:e2e`: 152 passed and 63 documented skips, including startup/reload, OPFS,
  IndexedDB, rollback, offline, all financial surfaces and 100,000-record performance checks.
- Local secret/token persistence scan found only synthetic test tokens and the redaction rules.
- Pending external evidence: live OAuth/Drive round-trip with a deployment Client ID and test
  account; the local environment intentionally contains no Google credential.

## Phase 11 Google account onboarding — 2026-08-02

- Shared-session, onboarding, App integration and OAuth prompt suites: 5 files and 38 targeted
  tests passed; strict web typecheck and lint passed.
- Configured synthetic production build and onboarding E2E passed at 320, 375, 768, 1024 and
  1440 px (5/5), including focus containment, axe, overflow, offline continuation and reload.
- The E2E Client ID is syntactically valid and synthetic; no token, account or financial fixture is
  present. The authorized live OAuth round-trip remains the explicit external gate.
- `pnpm verify`: 108 test files passed, 1 skipped; 388 tests passed and 4 documented skips;
  formatting, lint, workspace typechecks and production PWA build completed.
- Full `pnpm test:e2e`: 152 passed and 68 documented skips. The first run reached the five-minute
  command limit without a test failure; the unchanged rerun completed in five minutes.

## Phase 11 Google Drive opt-in entry point — 2026-08-08

- Removed the startup onboarding: Google Identity Services is now reachable exclusively after the
  explicit **Collega Google Drive** action in Backup; no OAuth prompt or account state is shown on
  the dashboard.
- App, BackupPage, OAuth provider and configuration suites: 5 files, 37 tests passed.
- Configured Backup E2E passed at 320, 375, 768, 1024 and 1440 px; the initial parallel run had
  one Chromium launch interruption at 768 px, and the isolated rerun passed.
- Browser smoke verified a normal dashboard startup and the Backup-only Drive entry point without
  reading or modifying financial data. The real authorized-account upload/reopen/restore drill
  remains external evidence pending OAuth Console publishing and origin configuration.

## Phase 11 GIS callback resilience — 2026-08-08

- The identity loader now waits for the OAuth API after an already-present GIS script and fails
  boundedly if the API never becomes ready; retries do not silently wait on an already-fired load
  event.
- Google token-client popup failures are reported immediately without tokens or account data. The
  Backup UI exposes distinct accessible recovery messages for a closed popup, a blocked popup and
  an unknown GIS failure.
- OAuth, loader, provider and BackupPage suites: 4 files and 29 tests passed. Lint, workspace
  typecheck and production build passed. Configured Google Drive entry-point E2E passed at 320,
  375, 768, 1024 and 1440 px (5/5).
- The live account reaches consent after the test-user configuration. An automated Chrome popup
  cannot complete the opener callback after takeover, therefore no upload/reopen/restore evidence
  is claimed and no archive was created.

## Phase 11 OAuth user-activation fix — 2026-08-08

- Root cause: `connect()` awaited GIS script loading before it invoked `requestAccessToken`, so a
  first-time script load could lose the explicit click's browser user activation and close the
  account chooser without a token callback.
- GIS now preloads silently after the user opens Backup. The connection control remains disabled
  until it is ready, and its explicit click calls the token client without an intervening await.
- Targeted OAuth, loader and BackupPage suites: 3 files, 17 tests passed. Lint, workspace
  typecheck and production build passed. The configured Google Drive entry-point E2E was rerun
  across the five configured viewports; the live chooser stayed open awaiting account selection.
- No token, account identity, archive content or financial data was inspected, logged or persisted.
  Upload, reopen and restore remain the separate external live gate.

## Phase 11 OAuth isolated bridge — 2026-08-08

- Reproduced the post-consent failure: `COOP: same-origin` on the ledger shell severs the direct
  Google popup callback. A global `restrict-properties` alternative made
  `crossOriginIsolated` false and was rejected because it breaks OPFS.
- The application and bridge header unit tests, nonce/channel negative tests, provider and Backup
  UI tests: 5 files, 23 tests passed. Workspace typecheck, lint and production build passed.
- HTTP smoke on the fresh production preview: shell `COOP=same-origin`, bridge
  `COOP=same-origin-allow-popups`, both with `COEP=require-corp`.
- Configured Drive entry-point E2E passed at 320, 375, 768, 1024 and 1440 px. It opens the static
  bridge rather than the PWA fallback. OPFS and IndexedDB offline persistence passed at 1440 px;
  the same focused suite skips its mobile and tablet duplicates by design (2 passed, 8 skipped).
- Pending external evidence remains the authorized live account's upload/reopen/restore drill;
  no token, account identity or archive was captured during this validation.

## Phase 11 OAuth bridge CSP regression — 2026-08-08

- Root cause: the static bridge used an inline handler, correctly rejected by the page CSP. The
  visible button therefore had no listener.
- The handler now loads from a same-origin static JavaScript file. Production bridge E2E verifies
  that the control is enabled and reports a bounded “Google non è ancora pronto” state if GIS is
  unavailable, without contacting Google or creating a session.
- Web production build passed; bridge E2E passed at 320, 375, 768, 1024 and 1440 px (5 passed;
  5 optional account-onboarding tests skipped because the synthetic consent flag was not set).

## Critical reset and app-lock recovery — 2026-08-08

- Financial reset now makes encrypted backup creation explicitly optional: a new, user-chosen
  passphrase is required only when creating that backup. The full local reset clearly requires
  only the visible confirmation phrase and preserves Google Drive backups.
- A forgotten app-lock PIN has no bypass or recovery secret. Once the ledger is ready, the lock
  screen exposes the same explicit total-local-reset route; it removes the local lock together
  with the other local data only after confirmation.
- Targeted settings, reset and app-lock suites: 6 files and 25 tests passed, including optional
  backup skip, short/tampered backup rejection, lock removal, confirmation gating and unavailable
  recovery before ledger readiness.
- `pnpm doctor`, lint, typecheck and production PWA build passed. Full unit suite passed:
  110 files passed, 1 skipped; 399 tests passed, 4 documented skips.
- The backup manual UI E2E now accepts both deliberately supported runtime configurations
  (Drive enabled and Drive not configured); focused suite passed at 320, 375, 768, 1024 and
  1440 px with the single desktop round-trip (6 passed, 4 intentional skips). Full E2E rerun
  passed after the production build: 157 passed, 68 documented skips.
- Browser smoke opened both reset dialogs and confirmed their wording and disabled destructive
  controls without entering a confirmation phrase or altering any local or cloud data.

## Phase 12.1 — Hierarchical financial categories — 2026-08-08

- Domain hierarchy tests cover a valid macro/subcategory pair, missing and archived parents,
  self-reference, third level, scope compatibility and `both` parents. SQLite and IndexedDB tests
  persist `parentId`, reject a third level and reject archiving a macro with children.
- Category command and component tests cover explicit and idempotent default-taxonomy installation
  on a fresh ledger, creating/moving a subcategory and rendering the accessible category tree. Transaction
  view-model coverage keeps archived categories readable in historical movements while excluding
  them from new choices.
- Targeted suites: 71 tests passed across domain, commands, UI, SQLite, IndexedDB and transaction
  view model. `pnpm lint`, full typecheck and production PWA build passed.
- Category E2E passed at 320, 375, 768, 1024 and 1440 px: creation, rename, archive, merge,
  horizontal-overflow check and axe scan. The first E2E run revealed an invalid `treeitem` role on
  a `section`; it was corrected to a valid `div` before the passing rerun.
- `pnpm codex:validate` passed. Repository-wide `format:check` is blocked only by the pre-existing,
  out-of-scope `apps/web/src/reset/financialReset.test.ts`; no category-slice file is unformatted.

## Phase 12.2 — Expense behavior classification and recurring-model alignment — 2026-08-08

- Domain tests cover classified expenses, valid legacy unclassified movements, unsupported values,
  rejected income/transfer/adjustment attributes and preservation after cancellation. The pure
  behavior summary excludes cancelled entries, transfers and adjustments.
- SQLite/OPFS migration v16, IndexedDB v16, Tauri opening, in-memory category merge and portable
  backup tests cover new-value round trips plus snapshots produced before the new optional fields.
- Targeted domain, migration, persistence, portable-backup, export and recurring component suites:
  10 files, 90 tests passed. Workspace typecheck, lint and production web build passed.
- Transaction E2E passed at 320, 375, 768, 1024 and 1440 px (35 tests): optional expense details,
  transfer exclusion, transaction flow, responsive split controls, reset paths and axe scans.
- Repository-wide `format:check` remains blocked only by the pre-existing, out-of-scope
  `apps/web/src/reset/financialReset.test.ts`; no Phase 12.2 file is unformatted.

## Phase 12.2 final closure — 2026-08-09

- The previous baseline-format blocker was isolated in `b8d3de1` and is now green under
  `pnpm format:check`; the commit changes only Prettier formatting in
  `apps/web/src/reset/financialReset.test.ts`.
- The recurring editor now filters categories from the currently selected kind, remounts every
  uncontrolled field when switching rule/new editor, and formats an existing monetary amount for
  the decimal input. The last correction prevents an edited €2,500.00 rule from becoming
  €250,000.00 and breaking its confirmed-salary allocation match.
- Focused verification passed: recurring component and domain/persistence suites (66 tests), then
  the recurring and transaction browser flows at 320, 375, 390, 768, 1024 and 1440 px. The flows
  cover type/category switching, edit A → edit B → new, salary allocation after editing, split and
  expense-details responsive controls, reset dialogs, keyboard Escape/focus return, axe checks and
  horizontal-overflow assertions.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and production `pnpm build`
  completed without failures. The `pnpm verify` aggregate re-ran the same formatting, lint,
  typecheck, unit and production-build gates.
- Final independent product/domain, import/backup and UX/UI reviews reported no unresolved P0 or
  P1; no Phase 12.3 file or migration v17 is included.

## Phase 12.3 final closure — 2026-08-11

- PR #3 (`feature/phase-12.3` → `main`) was reviewed by product/domain, import/backup and UX/UI
  reviewers. No unresolved P0 or P1 remained. The scope explicitly excludes automatic transaction
  creation, recurring occurrences, skip and transaction-to-rule lineage.
- The additive SQLite migration v17 and the physical IndexedDB v18 upgrade were exercised through
  legacy upgrade and reopen coverage. The IndexedDB active-due index is recreated and backfilled
  during the v18 upgrade, including databases previously opened at v17.
- Targeted regressions passed for recurring calendar rules, SQLite and IndexedDB repositories,
  portable snapshot/backup compatibility and the 1440px IndexedDB persistence E2E. They cover
  weekly/monthly/annual schedules, nominal-versus-effective weekend handling, paused rules,
  legacy v16 rules, backup schema compatibility and IndexedDB reopen behavior.
- GitHub Actions `verify` passed on the PR commit `f7f94d2` and again after merge to `main` at
  `0ea79e8`: install, doctor, formatting, lint, typecheck, unit tests, production build,
  manifest check and Playwright E2E all completed successfully. The frozen recovery checkpoint
  `backup/pre-phase-12.3-worktree-20260809` remains at `862c2a7`.
## Fase 12.5.C2.6 — 2026-08-24

- Esito: BLOCKED (blocco architetturale; nessuna modifica runtime).
- File analizzati: `apps/web/src/App.tsx`, `apps/web/src/transactions/TransactionsPage.tsx`, package application pertinenti, `packages/database/src/indexeddb/IndexedDbLedgerRepository.ts`, `packages/database/src/sqlite/SqliteLedgerRepository.ts`, `packages/database/src/in-memory/InMemoryLedgerRepository.ts`, `docs/adr/0005-transfers.md` e `docs/ux/MOCKUP_INTEGRATION.md`.
- Evidenze: il callback disponibile per i trasferimenti è `onCreateTransfer`; il ramo `kind === "transfer"` usa sempre la creazione anche con `editingId`; i repository rifiutano l’aggiornamento indipendente delle gambe collegate. Non esiste un callback application `onUpdateTransfer` esposto all’app.
- Verifiche eseguite: `pnpm codex:route --task "Fase 12.5.C2.6: migliorare esclusivamente la UX/UI di creazione e modifica dei trasferimenti bancari, preservando invarianti finanziarie, command layer e persistenza; aggiungere test e gate"` PASS; ispezione mirata repository/documentazione e ricerca dei callback/comandi PASS.
- Gate: `pnpm format:check` FAIL (drift Prettier repository-wide: 422 file segnalati; nessuna riscrittura di formattazione applicata perché la fase è bloccata e il problema non è confinato alle due modifiche documentali).
- Gate: `pnpm codex:validate` PASS (`Nexora Task Orchestrator valid: 17 routes`).
- Gate non eseguiti: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm manifest:check`, E2E/browser e verifica visuale. Non è stata modificata la runtime.
- Viewport/limitazioni: nessuna validazione UI eseguita; la modifica UI richiesta non può essere completata senza ampliare il command/application layer, fuori scope.
- Sblocco richiesto: decisione esplicita e fase autorizzata per aggiornare atomicamente il trasferimento come operazione sulle due gambe, poi implementazione UX/test.
## 12.5.C3.3-R2 — Dashboard/Home monthly financial overview correction — COMPLETE — 2026-08-26

- Correzione applicativa reale di `Dashboard.tsx`, `buildDashboardViewModel.ts`, `appModels.ts` e
  `page.css`; C3.4 resta COMPLETE e C3.5 resta il prossimo task.
- KPI filtrati per mese locale `Europe/Rome` con `today` iniettato: entrate, spese, risparmio,
  saving rate e confronto agosto/luglio 2026; trasferimenti e annullati esclusi dal dominio.
- Budget/soglie/split via `resolveActiveBudgetsForPeriod` e `calculateBudgetProgress`; ricorrenze
  attive come fonte delle prossime uscite; top categorie e ultimi 5 movimenti reali.
- Disponibilità: conti attivi `checking`, `savings`, `cash`; virtual subaccounts/investimenti/
  prestiti esclusi e decisione registrata in `docs/DECISIONS_LOG.md`. Fine mese e alert locali
  restano deferred per assenza di regola condivisa affidabile.
- Test mirati: ViewModel 6/6 e App 16/16 PASS; typecheck, lint e build PASS.
- Browser: C3 Dashboard E2E eseguito su 320, 375, 390, 768, 1024 e 1440; axe, overflow,
  label delle nuove sezioni, keyboard CTA e zoom 200% PASS dopo correzione contrasto trend.
- Review: `.codex/reviews/ui-ux/2026-08-26-c3-3-r2-dashboard-home.md`, P0=0, P1=0.

## 12.5.C3.3-R4 — Dashboard Visual Baseline & Evidence Closure — COMPLETE — 2026-08-26

- Accessibilità: l’unico H1 visibile è `Panoramica finanziaria` e il suo accessible name coincide
  con il testo visibile; rimossa l’ARIA ridondante che esponeva il vecchio titolo.
- Baseline visuale: il test senza update ha rilevato la baseline obsoleta; lo screenshot generato
  è stato verificato visivamente in Chrome e mostra la UI R3 corrente, quindi è stata aggiornata
  soltanto `dashboard-1440-chromium-1440-win32.png`. Il test è stato rieseguito senza update e ha
  chiuso con 2/2 PASS.
- Browser: E2E Dashboard verificato su 320, 375, 390, 768, 1024 e 1440 px; zoom 200% già PASS
  in R3 e preservato. Nessuna baseline di altre schermate è stata modificata.
- Financial regression: cash flow mensile, transfer/cancelled exclusion, saving rate, stato e
  overlap Budget, prossime uscite, top categorie, trend, multi-valuta/account count e zero-value
  chart restano coperti; suite completa 589 PASS / 4 skip previsti.
- Severity: P0=0, P1=0, P2=0.
- Esito: `SCREEN_AUDIT_PASS`; Dashboard/Home `FROZEN` per C3. C3.5 resta il prossimo task.

## 12.5.C3.5 — Transactions quick-filter visual correction — IN PROGRESS — 2026-08-26

- Riproduzione Chrome: i filtri rapidi desktop erano pulsanti nativi non stilizzati e si
  impilavano sotto l’intestazione della lista; il campo di ricerca risultava spinto sotto la
  gerarchia prevista.
- Correzione: aggiunti layout flex, token Nexora, stato `aria-pressed="true"` visibile, focus
  nativo coerente e target minimi da 44 px; su desktop il gruppo usa due colonne, su mobile
  conserva lo scorrimento orizzontale.
- Chrome reale: `#transactions`, viewport `1278 px`; filtri verificati con `Tutti` attivo,
  altezze `44 px`, stile selezionato blu e `scrollWidth === clientWidth` (`1263/1263`).
- Test mirati: `TransactionsPage.test.tsx` `12/12 PASS`; `transactions.spec.ts` desktop/mobile
  `20/20 PASS`, inclusi axe, filtri combinabili, overflow, trasferimenti, split e dialog.
- Gate statici: format, lint e typecheck PASS; build PASS.
- Stato audit: P0=0, P1 corretto; C3.5 resta `IN_PROGRESS` fino alla chiusura completa della
  review Mobile/Desktop.

## 12.5.C3.5 — Mobile standalone transaction editor correction — COMPLETE — 2026-08-27

- Riproduzione: su `#transactions` mobile, `Nuovo movimento` lasciava la lista prima del form e
  il campo `Conto` risultava oltre il viewport.
- Correzione: su `#new-transaction` mobile la lista viene nascosta, l’editor occupa tutta la
  larghezza disponibile e il campo `Conto` è immediatamente disponibile; lo scrolling verticale
  del form resta preservato.
- Chrome reale: verificato a 320, 375 e 390 px; editor full-width da bordo a bordo, lista
  `display: none`, `Conto` visibile e nessuna scrollbar orizzontale resa visibile.
- Test: regression E2E dedicata PASS; suite `transactions.spec.ts` sui progetti Chromium 320 e
  1440: `22/22 PASS`; format, lint, typecheck e build PASS.
- Stato audit: correzione mobile COMPLETE; audit completo C3.5 Mobile/Desktop resta `IN_PROGRESS`.

## 12.5.C3.5 — Transactions regression closure — PASS — 2026-08-30

- Chiusura: `SCREEN_AUDIT_PASS`; baseline C2.9 confermata e Movimenti congelata per C3.
- Browser Chrome: `#transactions` popolata con dataset demo, ricerca/filtri/form verificati;
  console app senza errori rilevanti. I messaggi “listener asynchronous response” sono rumore
  dell’estensione Chrome.
- Gate: `pnpm test` `589 PASS / 4 skip`, E2E Movimenti `66/66 PASS` sui sei viewport,
  `manifest:check`, `codex:validate`, `quality:ui-ux`, format, lint e typecheck PASS.
- P0/P1/P2: nessuno aperto. Prossimo task autorizzato: `12.5.C3.6 — Budget Mobile/Desktop audit`.

## 12.5.C3.5 — Transactions regression Mobile/Desktop audit — BLOCKED — 2026-08-28

- Routing: `localized_bug`, profilo `STANDARD`, rischio dati `low`; baseline `12.5.C2.9
  TRANSACTIONS_GATE_PASS`; nessun redesign o nuova feature introdotti nella review.
- E2E Movimenti: `transactions.spec.ts` `66/66 PASS` sui progetti Chromium 320, 375, 390, 768,
  1024 e 1440; inclusi lista/empty, ricerca, filtri, form, Entrata/Uscita, trasferimento,
  split, dialog e gestione cestino. La regression dedicata al form mobile è inclusa.
- Browser Chrome: route `#transactions` e stato empty leggibili nel tab utente; il dataset demo
  non è stato caricato perché l’archivio locale ha restituito l’errore protetto “Nexora non riesce
  ad aprire i tuoi dati”. Non sono stati modificati o resettati dati dell’utente. Evidence Chrome
  precedente del fix mobile: 320/375/390, editor full-width, `Conto` visibile, lista nascosta.
- Gate globali: format, lint, typecheck, `codex:validate` e `quality:ui-ux` PASS; `pnpm test`
  ha `589 PASS`, `1 skipped` e 4 skip documentati dopo l’allineamento del fixture cestino in
  `SettingsPage.test.tsx`; `manifest:check` resta BLOCKED perché `PROJECT_MANIFEST.json` è stale
  rispetto alle modifiche locali fuori scope.
- Zoom 200%: baseline C2.7-F1 resta PASS e non è stata introdotta una modifica strutturale
  desktop; la nuova chiusura C3.5 dedicata resta sospesa insieme ai gate globali.
- Esito: `SCREEN_AUDIT_BLOCKED`; P0/P1 Movimenti dimostrati: nessuno. C3.5 non è chiusa solo per
  il manifest fuori scope; C3.6
  non viene iniziata.

### C3.5 visual spacing follow-up — 2026-08-28

- Chrome feedback confirmed search label, date headings, and transaction rows were too close to
  the panel edge at 1440 px and on mobile.
- Scoped CSS correction adds `12 px` horizontal inset to the search block, date headings, and
  transaction rows; Chrome confirmed the spacing visually and no horizontal overflow.
- Regression: `TransactionsPage.test.tsx` `12/12 PASS`; `transactions.spec.ts` Chromium 320/1440
  `22/22 PASS`; lint, typecheck, format and diff check PASS.

### C3.10 Analytics panel spacing follow-up — 2026-08-30

- Chrome verification: the forecast metric group has a uniform `24.8 px` outer inset at 1440 px
  and 375 px; `scrollWidth === clientWidth` at both viewports.
- Component test: `AnalyticsPage.test.tsx` `2/2 PASS`.
- UI gate: `pnpm test:ui-ux` `8/8 PASS`.
- Responsive smoke: `phase-12-surfaces.spec.ts` `6/6 PASS` across Chromium 320, 375, 390, 768,
  1024 and 1440.
- Follow-up spacing: panel separation is `20 px` and comparison content keeps `24 px` bottom
  padding in Chrome at 1440 px and 375 px.

### C3.10 Analytics redesign — 2026-08-31

- View model/component tests: `AnalyticsPage.test.tsx` and `buildAnalyticsViewModel.test.ts`
  `4/4 PASS`; domain trend regression included.
- Typecheck: `pnpm typecheck` PASS.
- Build: `pnpm build` PASS.
- E2E: `phase-12-surfaces.spec.ts` `6/6 PASS` on Chromium 320, 375, 390, 768, 1024 and 1440;
  coverage includes month navigation, 3-month trend window, summary, categories, changes and
  forecast ordering.
- Browser: Chrome dev surface verified at 1440 px; seven sections are ordered with forecast last,
  month navigation and trend window controls work, and no horizontal overflow is present.
- Status: C3.10 remains `IN_PROGRESS`; zoom 200%, keyboard-only evidence and full global gates
  are still pending before an audit PASS can be claimed.

### C3.10 Analytics redesign gate update — 2026-08-31

- Full test suite: `138 passed`, `1 skipped`; `597 passed`, `4 skipped` (documented skips).
- Lint, typecheck and build: PASS. `pnpm codex:validate`: PASS.
- `manifest:check`: BLOCKED because the repository manifest is stale against unrelated pre-existing
  worktree changes; no out-of-scope files were regenerated or staged.
- Review status remains `SCREEN_AUDIT_BLOCKED` pending dedicated 200% zoom and keyboard-only
  evidence, with no runtime/data integrity failure observed in the redesign.
- Browser follow-up: Chrome 200% smoke at 1024 px showed no horizontal overflow; keyboard traversal
  reached month navigation and all 3/6/12 month controls at 375 px without a trap.

### C3.10 Analytics closure — 2026-08-31

- Chrome follow-up: trend dates remain on one line, the expense bar has a coherent gap from the
  date, and the 3/6/12 month controls keep equal dimensions at 412 px and 1440 px.
- Component test: `AnalyticsPage.test.tsx` `2/2 PASS`; typecheck `PASS`.
- Manifest regenerated from a clean detached worktree at `cb70846`; `manifest:check` and
  `codex:validate` pass there. The original dirty worktree remains untouched outside the scoped
  files.
- Result: C3.10 `SCREEN_AUDIT_PASS / FROZEN`; no P0/P1/P2 findings remain.

### 12.5.C3.11 — Financial Journal Mobile/Desktop audit — 2026-08-31

- Chrome real: `#journal` checked at 320, 375, 390, 768, 1024 and 1440 px; CTA, editor,
  empty state, responsive reflow and no horizontal overflow verified.
- Chrome 1024 px at 200%: no horizontal overflow; CTA and form remain reachable.
- Chrome keyboard smoke at 375 px: focus reaches CTA, period, both textareas, control select,
  save and mobile navigation without a trap; touch CTA/save targets are 44 px high.
- Component/command tests: `JournalPage.test.tsx` and `journalCommands.test.ts` `5/5 PASS`.
- Full E2E: `phase-12-surfaces.spec.ts` `6/6 PASS`, including create, edit, delete confirmation
  and empty-state return for the journal.
- Full suite: `598 passed`, `4 skipped`; format, lint, typecheck and build PASS.
- Security/financial isolation: React renders journal text without unsafe HTML; commands call only
  monthly-journal repository methods and do not create transactions or alter financial metrics.
- Findings: P0=0, P1=0, P2=0. Result pending final isolated manifest gate.

### C3.11 Journal typography follow-up — 2026-08-31

- Component test: `JournalPage.test.tsx` `3/3 PASS`; typecheck `PASS`.
- Chrome: Dashboard and Journal compared at 1440 px and Journal checked at 412 px; financial
  amounts share JetBrains Mono, weight 750 and responsive metric sizing; labels share Inter
  styling; no horizontal overflow observed.

### Journal quick action follow-up — 2026-09-01

- Component/App test: quick action navigation test `1/1 PASS`.
- Chrome at 412 px: mobile `+` menu exposes “Diario finanziario”; selecting it navigates to
  `#journal`, closes the sheet and preserves no horizontal overflow.

### Dashboard comparison panel spacing follow-up — 2026-09-01

- Chrome at 412 px and 1440 px: comparison panel has `16px` bottom padding and no horizontal
  overflow; the following panel remains separated by the existing grid gap.
- Dashboard view-model tests: 8 failures remain pre-existing and date-sensitive because fixtures
  target the prior monthly period; typecheck `PASS`.

### Dashboard recent activity spacing follow-up — 2026-09-01

- Chrome at 412 px and 1440 px: `Movimenti recenti` has an additional `16px` bottom inset after
  the final action; no horizontal overflow observed.

### Dashboard top expenses empty-state spacing follow-up — 2026-09-01

- Chrome at 412 px and 1440 px: the “Spese principali” panel uses a balanced `24px` bottom inset
  for its empty state; no horizontal overflow observed.

### Dashboard top expenses empty-state spacing refinement — 2026-09-01

- Chrome at 412 px: the empty “Spese principali” panel now uses a `32px` bottom inset; no
  horizontal overflow observed.

### Dashboard recent activity top spacing follow-up — 2026-09-01

- Chrome at 412 px and 1440 px: `Movimenti recenti` has a `20px` top separation from the previous
  panel and no horizontal overflow.

### Dashboard accounts panel spacing follow-up — 2026-09-01

- Chrome at 412 px and 1440 px: the “Disponibilità / Conti” panel has a `20px` top separation
  from “Movimenti recenti”; no horizontal overflow observed.

### 12.5.C3.11-F — Deterministic Dashboard and Budget date tests — 2026-09-01

- Root cause: dashboard view-model tests relied on the runtime default `new Date()` while their
  fixtures and assertions target August 2026; after the calendar moved to September, monthly
  income/expense/savings, saving rate, budgets, month status and related period projections used
  2026-09 instead of 2026-08.
- Scoped change: added test-only `DASHBOARD_TEST_TODAY` (`2026-08-15T12:00:00+02:00`) and passed
  it explicitly to the affected Dashboard view-model calls. Runtime code and Dashboard UI were
  not modified; runtime date behavior remains unchanged.
- Dashboard suite: `20 passed`, `0 failed`, `0 skipped` across 2 test files.
- Budget follow-up: `BudgetsPage` accepts an optional test date while retaining the runtime default;
  the component test now pins August 2026 so its February fixture remains deterministic.
- Global suite: `599 passed`, `4 skipped`, `0 failed` across 139 files.
- Quality gates: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm manifest:check`, `pnpm codex:validate` and `pnpm quality:ui-ux` all PASS.
- Result: Dashboard and Budget date-sensitive failures resolved; C3.11 remains COMPLETE, Dashboard
  remains FROZEN, and C3.12 remains NEXT. Overall C3.11-F gates are PASS.

### 12.5.C3.14 — Import Mobile/Desktop audit — 2026-09-01

- Browser audit: `#imports` checked at 320, 375, 390, 768, 1024 and 1440 px; local file picker,
  mapping, preview, status summary, confirmation and import history/undo remain reachable without
  critical overflow. Browser inspection was read-only and did not alter the local ledger.
- Supported paths verified against source: Money Manager XLSX, generic CSV, Mediobanca CSV/XLSX and
  N26 PDF. Tags are N/A because no current importer persists Tag relations.
- Domain/importer: preview/dry-run write nothing; exact account/currency matching, explicit new
  account/category proposals, transfer semantics, minor-unit amounts, source audit, duplicate
  re-import, atomic batch and batch-scoped undo are covered by existing tests.
- Scoped UI correction: the intro now names CSV as supported and the selected filename is visible
  in the migration plan, mapping and preview headings; long names wrap safely.
- Zoom: Chromium E2E desktop-only at 200% on 1024/1440; file picker and heading remain usable and
  the width criterion is satisfied.
- Tests: Importer/UI targeted suite `53 passed`, E2E Import `38 passed`, `4 skipped` (zoom test
  intentionally desktop-only), build `PASS`.
- Review: `.codex/reviews/ui-ux/2026-09-01-c3-14-import.md`.
- Result: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Import is `FROZEN`; C3.15 Export is next.

### 12.5.C3.12 — Categories Mobile/Desktop audit — 2026-09-01

- Browser audit: `#categories` checked at 320, 375, 390, 768, 1024 and 1440 px; no horizontal
  overflow, editor reflow, tree readability and action reachability verified.
- Zoom: Chromium desktop-only 200% E2E smoke keeps heading, form, CTA and dimensions usable.
- Domain/repository: two-level hierarchy, compatible scopes, stable category IDs, self-parent/cycle
  rejection, archived-parent protection, used-reference delete protection and atomic merge verified.
- Cross-screen: Transactions, splits, Budget, Analytics, Recurring and Import preserve category
  references by ID; no surface was reopened.
- Accessibility/security: explicit tree `aria-level`/position/set size added for macro and child;
  labels and axe E2E pass; user names render as text with no unsafe HTML.
- Tests: targeted Categories/domain `12 passed`; repository category coverage `92 passed`; E2E
  Categories matrix `13 passed`, `5 skipped` (zoom test desktop-only); full suite `599 passed`,
  `4 skipped`, `0 failed`.
- Quality gates: `pnpm verify`, `pnpm manifest:check`, `pnpm codex:validate` and
  `pnpm quality:ui-ux` PASS.
- Result: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Categories is `FROZEN`; C3.13 Tags is next.
