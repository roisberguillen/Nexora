# Test evidence

## 12.5.C3.0 — Full Mobile/Desktop screen audit preparation — COMPLETE — 2026-08-24

- Routing: pnpm codex:route --task C3.0 — PASS; documentation, ECONOMY, low data risk.
- Gate di ingresso verificati: C2.9 COMPLETE, TRANSACTIONS_GATE_PASS, Movimenti congelata,
  P0/P1 aperti assenti, branch codex/phase-12-5-0-checkpoint.
- Documenti analizzati: stato corrente, roadmap, evidence, review finale C2.9, repository map,
  MOCKUP_INTEGRATION, DESIGN, STITCH_UI_REFERENCE, STITCH_SCREEN_MATRIX, MOBILE_UI_IMPLEMENTATION_PLAN,
  PRIMARY_FLOWS, manifest UI/UX, template v2 e agent guidance UI/UX/QA/security.
- Repository reale confrontato: 34 superfici/stati inventariati contro la routing hash di App.tsx;
  nessuna route artificiale introdotta. Allocazioni restano in #recurring; startup/recovery in
  bootstrap; Movimenti è regression review C3.5 su gate C2 esistente.
- Framework e checklist: docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md; template standard:
  .codex/templates/c3-screen-audit.md; tracking: .codex/state/ui-screen-review-matrix.md.
- Coperti: mobile-first 320/375/390, tablet 768, desktop 1024/1440, zoom 200%, keyboard/focus,
  safe area, touch >=44 px, responsive, funzionalità, stati, edge case, accessibilità, severity,
  browser evidence, PASS/BLOCKED e freeze rule.
- Nessun codice applicativo, CSS/SCSS, dominio, database, repository, import, backup, Tauri o test
  funzionale modificato.

## Phase 12.5.C2.4 chronological grouping and transaction detail — complete — 2026-08-18

- The UI-only implementation groups the existing, already filtered and sorted transaction view
  model by civil booked date for chronological sorts (`Oggi`, `Ieri`, Italian long dates, with a
  year only when needed). Amount sorting deliberately retains one neutral `Movimenti` group rather
  than implying a false date order.
- Opening is available only from the explicit row control. The desktop contextual panel and the
  mobile full-screen surface expose only projected data: amount, account, category, booked date,
  type, source, payee, description and transfer route. Split/tag data are intentionally absent
  because they are not part of `TransactionListItem`; no domain, repository or persistence contract
  was changed. Escape and Close restore focus to the opened row.
- Targeted Vitest: **3 files, 13/13 passed, 0 skipped** (`transactionDateGroups`,
  `TransactionList`, `TransactionsPage`). It covers relative/year labels, filtered/sorted grouping,
  neutral amount ordering, explicit open control, Escape and focus return. Web typecheck passed.
- A global-concurrency regression made `App` import-preview and `AppLockScreen` recovery time out
  despite passing in isolation. Their bounded test waits were made resilient without changing
  runtime behavior. Targeted regression: **12/12 passed**; full `pnpm test`: **136 files passed,
  1 skipped; 560 tests passed, 4 documented skips**. Workspace build passed with the known
  non-blocking chunk-size advisory; manifest regeneration/check and `pnpm codex:validate` passed.
- Browser regression: movement route transitions now synchronize the standalone editor state, so
  transfer, split and financial-detail controls render after `Nuovo movimento`. Saving or closing
  the standalone editor returns to `#transactions`. The E2E locator now targets the amount textbox
  rather than the new sort option, and date grouping preserves valid nested-list semantics. The
  transfer, split and financial-detail flows pass **18/18** across 320, 375, 390, 768, 1024 and
  1440 px, including the existing axe assertion.

## Phase 12.5.C2.3 movements banking-list redesign — partial — 2026-08-18

- The UI-only list implementation uses the existing transaction view model, `FinancialAmount` and
  `NavIcon`. It adds title/category/account/date hierarchy, real status/source indicators, neutral
  transfer amounts, a contextual action menu and opt-in bulk selection without changing command or
  persistence behavior.
- Targeted Vitest: **3 files, 10/10 passed, 0 skipped** (`TransactionList`, `TransactionsPage`,
  `buildTransactionsViewModel`), covering title fallback, financial amount semantics, badges,
  menu permissions, Escape/focus return and selection visibility. Web typecheck and lint passed.
- Responsive Playwright list smoke: **4/4 passed, 0 skipped** at 320, 390, 768 and 1440 px,
  including axe, menu keyboard behavior and horizontal-overflow checks. A first run caught insufficient
  contrast caused by dimming cancelled rows; the visual treatment was changed to a token surface and
  text decoration, then all four viewports passed.
- `pnpm verify` passed after formatting and manifest regeneration: **135 files passed, 1 skipped;
  553 tests passed, 4 documented skips**. `pnpm manifest:check` and `pnpm codex:validate` passed.
- The complete `test/e2e/transactions.spec.ts` run is **not green**: existing form-flow tests cannot
  find the transfer type, split button or financial-detail control after activating `Nuovo movimento`
  (observed at 320 and 375 px before cancellation). This is outside the list redesign and prevents
  declaring the phase complete or publishing a commit.

## Phase 12.5.C2.1 movements hierarchy and KPI — complete — 2026-08-17

- The Transactions view model now delegates overall and month-scoped Income/Expense/Net totals to
  the existing domain `summarizeCashFlow` report with the standard EUR display currency. This keeps
  cancelled transactions and both transfer legs out of the three KPI without duplicating accounting
  logic. A month with no matching movement displays the same zero-valued domain report.
- Targeted component/view-model suite: **5/5 passed** (`TransactionsPage` plus
  `buildTransactionsViewModel`), including title, accessible primary CTA route, KPI amounts,
  selected-month update, cancelled income and transfer exclusion.
- Responsive E2E: `CI=1 NEXORA_E2E_PORT=4177 pnpm exec playwright test
  test/e2e/transactions.spec.ts test/e2e/global-search.spec.ts` passed on the configured matrix
  (320, 375, 390, 768, 1024 and 1440 px): **50 passed, 4 documented responsive skips, 0 failed**.
  The Movements transfer flow retained its no-horizontal-overflow and axe checks.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (**547 passed, 4 documented skips**), `pnpm verify`,
  `pnpm manifest:check` and `pnpm codex:validate` passed. Build retained only the known
  non-blocking chunk-size advisory.
- Deferred unchanged: banking search, quick filters/drawer, ordering, list and editor redesign,
  detail panel, action menu and mobile navigation belong to 12.5.C2.2–12.5.C2.8.

## Phase 12.5.D review — complete — 2026-08-17

- UI/responsive/accessibility review exercised the shell, navigation, accounts, movements,
  categories, tags, imports, budgets, loans, investments, recurring/allocation flows, exports,
  backup, analytics, journal, notifications, settings, profile and privacy through the complete
  Playwright route matrix. No product P0/P1 was found in the completed cases; 320, 375, 390, 768,
  1024 and 1440 px scenarios reported no overflow or accessibility failure. Existing 200% Budget
  zoom, keyboard, focus-return and dialog tests also passed.
- Security review: tracked files contain no real statement/workbook/PDF sources; `.gitignore`
  excludes real-data validation material. Targeted scans found no committed credentials or real
  IBAN/BIC. CSV parsing limits input to 10 MiB, 100,000 rows and 256 columns, rejects malformed
  quoting and preserves atomic import semantics. Portable snapshot tests reject malformed restores;
  CSP exceptions are constrained to WASM/OPFS, Google OAuth and the Tauri bridge. `pnpm audit
  --prod --audit-level=high` reported no known vulnerabilities.
- Targeted negative/accessibility suite: 30/30 passed for malformed CSV, portable restore,
  security headers, import UI, reset protection, dialogs and AppShell. `pnpm doctor`,
  `pnpm verify`, `pnpm format:check`, `pnpm codex:validate` and `pnpm manifest:check` passed.
- Full E2E: `CI=1 NEXORA_E2E_PORT=4176 pnpm test:e2e` completed the isolated 306-case matrix with
  **216 passed, 90 documented skips and 0 failures** in 6.4 minutes. The long IndexedDB 100,000
  record persistence exercise completed successfully (150,975 ms insertion; 2,086 ms listing), as
  did OPFS; the earlier incomplete observation was an interrupted run, not a teardown defect.
- P2: the production build retains the pre-existing >500 kB chunk-size advisory; it is not a
  functional, responsive or security regression.

## Phase 12.5.C desktop UX — complete — 2026-08-17

- Desktop navigation is now grouped by primary work, planning, wealth, analysis, organisation,
  data and system. It retains every existing route, adds the already-existing notifications,
  profile and privacy routes to the desktop menu, keeps the active route exposed, and supports a
  keyboard-operable collapsed desktop sidebar without changing mobile navigation.
- Transactions now have local, combinable search, month, account, category and kind filters with
  an explicit reset and a separate no-results state. Filtering uses the existing projected rows
  only; it neither changes the ledger nor unfolds transfer legs.
- The completed follow-up adds identity-preserving editing for eligible manual movements and an
  atomic transaction-with-details replacement contract. Split and tag details are preserved across
  InMemory, IndexedDB and SQLite; imported, reconciled, cancelled and transfer movements remain
  non-editable.
- Focused repository/command regression: 83/83 passed. Full `pnpm verify` passed with 133 test
  files passed, 1 skipped, 544 tests passed and 4 documented skips. The complete browser matrix
  was exercised on 320, 375, 390, 768, 1024 and 1440 px; approved desktop navigation baseline
  snapshots were refreshed following the intentional menu grouping change.

## Phase 12.5.C movement editing follow-up — complete — 2026-08-17

- Added an identity-preserving update path for active, manual, non-transfer movements in the
  InMemory, SQLite and IndexedDB repositories. Imported, reconciled and cancelled movements remain
  non-editable; transfers remain linked operations. The command preserves signed bigint money and
  validates account, currency and category references before the atomic repository write.
- Focused regression suite passed 10/10; web/database/domain typechecks, lint, production web
  build and manifest check passed. The production build retained only the known chunk-size advisory.
- The prior split/tag P1 is resolved by the atomic replacement contract; no data-loss workaround
  or test bypass was introduced.

## Phase 12.5.A real-source reconciliation — blocked by non-overlapping periods — 2026-08-16

- Read-only, local parser inspection did not write to a ledger, import batch, account, category,
  backup, fixture or log. The temporary inspection test was deleted after the check.
- Period check: source A contains 48 rows from 2026-07-30 through 2026-08-14; source B contains
  48 rows from 2026-06-02 through 2026-06-28; source C contains 45 rows from 2026-08-01 through
  2026-08-15. The three sources do not cover the same full period, so no matching, dry-run commit,
  undo or deduplication reconciliation was performed.
- The period-only inspection passed (1/1). Parser output included non-fatal ZIP metadata warnings
  while reading the local workbook; no source values or identifiers were emitted.

## Money Manager semantic migration fix — 2026-08-16

- The importer now builds one account decision per source account and one category decision per
  source path. Missing deterministic entities are created only during the final atomic commit;
  generic account types require one plan-level choice. Semantic profiles retain account aliases,
  account configuration and category targets.
- Explicit Money Manager transfers create balanced `Transfer` legs, while `Modifica Saldo` creates
  `adjustment` transactions. InMemory, IndexedDB and SQLite commit planned accounts, categories,
  movements, transfers and audit rows in one rollback-safe operation.
- Privacy-safe local validation of the user-provided workbook used an isolated in-memory repository:
  45 source rows, 3 account-plan entries, 7 macro categories, 14 category paths, 40 standard
  movements, 2 transfers and 3 adjustments; 45 ready, 0 review. The commit imported 45 rows, the
  repeated dry-run classified 45 duplicates, and undo cancelled all first-batch transactions.
  The temporary test and workbook inspection script were removed; no source row or value entered Git.
- Targeted suites: 96/96 for importer, command, UI and real adapter rollback; hierarchy/adapter
  follow-up 84/84; privacy/UI/import regression 21/21. Money Manager import Playwright: 6/6 at
  1440 px, including account/category creation, transfer, adjustment, deduplication and undo.
- Global gates before manifest regeneration: format, lint and typecheck passed; Vitest reported
  132 files passed, 1 skipped, 537 tests passed and 4 documented skips; production build passed
  with only the existing chunk-size advisory.
- Full `pnpm test:e2e`: 210 passed, 90 documented viewport/optional-flow skips, 0 failed in
  6.0 minutes. The Money Manager semantic flow passed on every configured viewport; the suite also
  completed the synthetic 100,000-record OPFS and IndexedDB checks. Runner output contained only
  the known `NO_COLOR`/`FORCE_COLOR` warning.

## Mediobanca Premier CSV detection fix — 2026-08-15

- Header-detected Mediobanca CSV normalization now uses `Data valuta` exclusively, preserves raw
  cells for audit, maps `Tipologia`, `Entrate`/`Uscite` and `Divisa`, and requires an existing
  named account or explicit local-account selection.
- Targeted Vitest: 25 passed across importer, ImportsPage, migration, SQLite/IndexedDB and local
  backup compatibility suites. Workspace typecheck passed.
- Import E2E: the Mediobanca path passed 6/6 configured viewports; the complete import flow passed
  5/5 at 1440 px. The user separately confirmed their local real-file test; no real source entered Git.

## Phase 12.5.2 isolated Mediobanca sample validation — complete — 2026-08-15

- Real source drill used only the user-authorized one-month CSV on 127.0.0.1:4174; the definitive
  5173 origin was not opened or mutated. No real file, row, amount, identifier or source hash was
  added to Git, fixtures, logs or this evidence.
- Structural parser check: 48 source rows, six expected columns, semicolon CSV, EUR, one signed
  outgoing amount cell per row and 48 valid Data valuta values. Data contabile was never used.
- UI dry-run after explicit mapping/account selection: 48 ready, 0 duplicate, 0 review, 0 ignored,
  0 invalid; the source-row invariant is exact. Commit: 48 imported. Undo: batch undone and all
  imported transactions cancelled. Re-run: 48 duplicate, 0 ready and no second movement created.
- Regression: apps/web/src/imports/importReview.test.ts passed 5/5. It covers an account-less valid
  row resolved by an explicit local account and preserves review status for invalid data.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm verify`
  passed after the fix. Full unit gate: 128 files passed, 1 skipped; 506 tests passed, 4
  documented skips. The isolated browser proof supplied the real-data E2E evidence; no real
  source was added to the automated suite.

## Phase 12.5.1 real-source mapping — complete — 2026-08-15

- Read-only analysis used three local user-provided files outside the repository. No ledger,
  account, transaction, category, import batch, backup or test fixture was created or modified.
- Mediobanca CSV: 48 data rows, semicolon delimiter, valid `Data valuta` on every row, EUR and
  Italian-decimal monetary syntax. The source has no narrative/account/category/identifier field.
- N26 PDF: 20 text-extractable pages, with Mastercard and six Space sections. The current N26
  parser returned zero matching candidate rows because its English month/simple-layout regular
  expression does not match the observed source layout.
- Money Manager XLSX: one visible sheet with 11 columns, 46 physical rows and 45 post-header source
  rows. Its Excel-serial civil date, first account, category/subcategory, note, kind, amount and EUR
  fields were mapped structurally without retaining values. It has 40 Mediobanca-labelled, four
  N26-labelled and one unresolved first-account row; no Directa-labelled row was found.
- The duplicate numeric `Conto`, undocumented `EUR` field and two transfer-marked rows are explicitly
  review-only. The current generic detector does not recognise `Giorno`/`Guadagni/Spese` or model a
  distinct destination account, so no import was run or authorized.
- No automated code test was changed or added. The report and state are documentation-only;
  `pnpm format:check`, `pnpm manifest:check` and `pnpm codex:validate` passed before publication.

## Phase 12.5.0 safe checkpoint — 2026-08-15

- Baseline: Phase 12 closure is recorded on `main` commit
  `9dc659cb995393b3fee30b03d8311b2b0b87d159`; the worktree was clean before
  creating the checkpoint documentation.
- `pnpm doctor`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`,
  `pnpm manifest:check` and `pnpm verify` passed. `pnpm verify` repeated format,
  lint, typecheck, the complete unit suite and the production build.
- Full unit suite: 128 test files passed, 1 skipped; 504 tests passed, 4 documented
  skips; 84.56 s. The verify rerun produced the same 504 passed / 4 skipped result.
- Synthetic backup/recovery drill: 3 test files and 16 tests passed in 6.43 s. It
  covers encrypted backup creation, passphrase/tamper/schema rejection, SQLite and
  IndexedDB restore, rollback and removal of the temporary recovery ledger.
- Full `pnpm test:e2e`: 198 passed, 90 documented skips, 0 failed, 6.2 min. It
  includes browser backup/restore, OPFS and IndexedDB persistence and rollback; the
  100,000-record performance cases use synthetic data only.
- Repository privacy scan: tracked import examples and E2E fixtures are synthetic;
  no tracked databases, bank statements, real IBANs or committed logs were found.
  The only IBAN-shaped string is an explicit synthetic redaction test in
  `packages/config/src/logging.test.ts`.
- The local real-data drill is isolated by browser origin (`127.0.0.1:4174` source,
  `127.0.0.1:4175` disposable restore) and dedicated ignored browser profiles. No
  active user ledger was opened, mutated or used by this checkpoint.

Keep only the latest relevant evidence per completed phase.

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
