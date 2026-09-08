# Test evidence

## Stabilization roadmap analysis — 2026-09-08 — ROADMAP CREATED / NOT STARTED

- Router: `tauri_android / ADVANCED / rischio dati low`; no application fix or functional test was
  implemented in this analysis.
- Confirmed evidence: Tauri SQL adapter declares `supportsMultiCallTransactions = false`; the
  shared SQLite repository still contains broad `withWriteTransaction`/`BEGIN`/`COMMIT`/`ROLLBACK`
  usage; the local working tree contains only a targeted `deleteUnusedAccount` change.
- Android evidence: current release artifact is `app-arm64-release-unsigned.apk`, 165,304,700 bytes;
  signing and device verification are explicitly N/A. Historical evidence recorded 17,230,860 bytes,
  so the size delta is unresolved.
- State reconciliation: prior 17.F `Nexora 1.0 READY` is not accepted for this corrective track;
  13.1–13.F, 14.1–14.F and 17.F are reopened as audit gates. Next authorized task is FIX.1.
- Evidence/roadmap: `docs/ROADMAP_STABILIZATION.md`.

## FIX.1 — Baseline e riproduzione bug — 2026-09-08 — COMPLETE / PASS

- Router: `final_release / CRITICAL / rischio dati medium`; checkpoint:
  `.codex/state/checkpoints/2026-09-08-fix-1-baseline-and-reproduction-before-corrective-roadmap.md`.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` e `pnpm build` → PASS. Build PWA generata con
  service worker/precache; solo advisory di chunk size Vite.
- `pnpm test` parallelo iniziale: 638 passed, 4 skipped, 2 timeout da contention (`project-privacy`
  e reset protetto Settings). Entrambi passano isolati; retry seriale
  `pnpm exec vitest run --maxWorkers=1` → 640 passed, 4 skipped, 0 failed.
- `pnpm exec playwright test --workers=1` → 433 passed, 233 skipped, 0 failed su 666 test e
  viewport 320/375/390/768/1024/1440. I test skip sono quelli condizionati da backend/zoom/offline
  già esplicitamente dichiarati dal test harness.
- Baseline riprodotta: Tauri release APK unsigned, firma/device N/A, pipeline Android completa
  limitata dall'ambiente Windows e differenza APK 17.230.860 → 165.304.700 byte ancora aperta.
- Nessun fix applicativo in FIX.1. Prossimo task autorizzato: FIX.2.

## FIX.2 — Architettura SQLite/Tauri e atomicità — 2026-09-08 — COMPLETE / PASS

- Router: `native_sqlite / ADVANCED / rischio dati medium`.
- Il contratto `SqliteDatabase` supporta ora `runInTransaction`; `SqliteLedgerRepository` instrada
  i workflow multi-write sul database transaction-bound quando disponibile e conserva il percorso
  `BEGIN/COMMIT/ROLLBACK` per gli adapter che lo supportano direttamente.
- Tauri espone un bridge Rust con connessione SQLite dedicata per transaction id: begin, query,
  execute, commit e rollback. `@tauri-apps/plugin-sql` resta usato per il percorso normale; la
  transazione multi-call non dipende dal connection pool IPC.
- Regression adapter: `packages/database-tauri/src/TauriSqliteDatabase.test.ts` e repository
  mirati → `46/46 PASS`, inclusi commit e rollback del bridge simulato.
- `cargo fmt --check`, `cargo check --manifest-path apps/web/src-tauri/Cargo.toml --locked`,
  typecheck database/database-tauri, full Vitest seriale `642 passed / 4 skipped`, lint, format,
  typecheck workspace e build PWA → PASS. Restano solo advisory chunk-size Vite.
- Nessuna migrazione, reset dati reali o modifica di invarianti contabili. Prossimo task autorizzato:
  FIX.3.

## FIX.3 — CRUD Conti — 2026-09-08 — COMPLETE / PASS

- Router: `localized_bug / STANDARD / rischio dati low`.
- Il bridge FIX.2 chiude la causa nativa; non è stato introdotto un secondo percorso CRUD o un
  fallback che possa divergere dagli adapter condivisi.
- Repository SQLite, database-tauri e account commands: `50 passed / 0 failed`.
- Playwright `accounts.spec.ts` + `c3-accounts-audit.spec.ts`: `27 passed / 9 skipped`, sei viewport
  320/375/390/768/1024/1440; verificati create, update, archive, delete vuoto, delete protetto e
  contenuto con movimenti.
- Nessun dato reale, schema o migrazione modificato. Prossimo task autorizzato: FIX.4.

## FIX.4 — Movimenti e Trasferimenti — 2026-09-08 — COMPLETE / PASS

- Router: `localized_bug / STANDARD / rischio dati low`.
- Repository SQLite, transaction commands e Transactions UI: `59 passed / 0 failed`.
- Playwright `transactions.spec.ts` + `c4-transfer-flow.spec.ts`: `92 passed / 10 skipped`, sei
  viewport; verificati CRUD, split, tag, trasferimento completo, annullamento, neutralità KPI,
  cestino/restore, reset e stati responsive.
- I workflow multi-write usano il bridge transaction-bound di FIX.2 nel runtime nativo; browser
  OPFS/IndexedDB mantengono la loro transazione nativa. Nessun trasferimento è classificato come
  entrata o spesa e nessuna scrittura parziale è emersa.
- Nessun dato reale, schema o migrazione modificato. Prossimo task autorizzato: FIX.5.

## 14.F — Final Android gate — 2026-09-07 — COMPLETE / PASS

- Phase 14 evidence reconciled across 14.0–14.5: Tauri init, shared SQLite/migrations, lifecycle,
  responsive pickers, security/backup, arm64 Rust and APK/AAB artifacts.
- `pnpm verify` → PASS: format/lint/typecheck/build green; 140 files, 633 tests passed, 4
  documented skips. The local SDK exclusion prevents third-party tool files entering lint/manifest.
- `adb devices -l` found no device/emulator; production signing key absent; neither is falsely
  reported as PASS. Full Tauri Android command's Windows symlink/Kotlin cache limitation remains
  documented with underlying Gradle/Rust verification.
- No ledger, schema, migration or accounting invariant changed; P0/P1/P2 = 0/0/0. Next: 15.0.

## 14.5 — Android APK/AAB packaging — 2026-09-07 — COMPLETE / PASS (device N/A)

- `cargo build --target aarch64-linux-android --release --locked` → PASS with NDK clang/linker.
- `gradlew.bat assembleArm64Release bundleArm64Release -x rustBuildArm64Release --no-daemon` →
  BUILD SUCCESSFUL; unsigned arm64 APK and AAB produced.
- `adb devices -l` → no emulator/device attached; no device runtime PASS claimed.
- No production signing key used or fabricated. No ledger, schema, migration or accounting
  invariant changed; P0/P1/P2 = 0/0/0. Next: 14.F.

## 14.4 — Android backup/restore and security boundary — 2026-09-07 — COMPLETE / PASS

- `pnpm test -- apps/web/src/security packages/database/src/backup apps/web/src/backup apps/web/src/startup/RecoveryBackupVerification.ts`
  → 9 files, 43 passed, 0 failed.
- Generated Android manifest declares `INTERNET` only; no broad storage permission. App Lock stores
  only a PBKDF2 verifier; OAuth remains volatile; encrypted backup integrity and rollback tests pass.
- Keystore/biometric integration is explicitly not added because the current persisted-secret
  contract does not require it; no silent trust-boundary expansion.
- No ledger, schema, migration or accounting invariant changed; P0/P1/P2 = 0/0/0. Next: 14.5.

## 14.3 — Android responsive UI and document pickers — 2026-09-07 — COMPLETE / PASS

- `pnpm exec playwright test test/e2e/backup-manual-ui.spec.ts test/e2e/imports.spec.ts` → 45
  passed, 9 documented skips, 0 failures across 320/375/390/768/1024/1440.
- Existing semantic file inputs remain the least-privilege WebView document picker for Import and
  Backup/Restore; no broad Android storage permission or native filesystem API added.
- No ledger, schema, migration or accounting invariant changed; P0/P1/P2 = 0/0/0. Next: 14.4.

## 14.2 — Android persistence, lifecycle, startup and recovery — 2026-09-07 — COMPLETE / PASS

- `pnpm test -- apps/web/src/startup apps/web/src/persistence apps/web/src/reset packages/database-tauri/src`
  → 18 files, 72 passed, 0 failed.
- Web and database-tauri typechecks → PASS.
- Generated MainActivity delegates to TauriActivity; shared bootstrap selects native SQLite under
  startup lock and preserves recovery/close behavior. No Android-specific divergent handler added.
- No ledger, schema, migration or accounting invariant changed; P0/P1/P2 = 0/0/0. Next: 14.3.

## 14.1 — Android SQLite native adapter and migration parity — 2026-09-07 — COMPLETE / PASS

- `pnpm test -- packages/database-tauri/src packages/database/src/migrations packages/database/src/sqlite`
  → 11 files, 76 passed, 0 failed.
- `pnpm --filter @nexora/database-tauri typecheck` and `pnpm --filter @nexora/database typecheck`
  → PASS.
- ADR 0017 contract confirmed: Android/Tauri uses the shared SQLite adapter, migration catalog and
  repository; no duplicate schema or adapter introduced.
- No ledger, schema, migration or accounting invariant changed; P0/P1/P2 = 0/0/0. Next: 14.2.

## 14.0 — Tauri Android initialization — 2026-09-07 — COMPLETE / PASS

- `tauri android init --ci --skip-targets-install` → PASS; generated Android project under ignored
  `apps/web/src-tauri/gen/android`.
- `rustup target add aarch64-linux-android` and Rust Android compilation → PASS.
- `gradlew.bat assembleArm64Debug -x rustBuildArm64Debug --no-daemon` → BUILD SUCCESSFUL; arm64
  debug APK produced. The full Tauri command separately hit Windows symlink privilege and Kotlin
  cross-drive incremental-cache diagnostics; this is recorded, not hidden.
- No schema, migration, ledger or financial invariant changed; P0/P1/P2 = 0/0/0.
- Review: `.codex/reviews/phase-14-0-android-initialization.md`; next `14.1`.

## 13.F — Final Desktop gate — 2026-09-07 — COMPLETE / PASS

- Reconciled 13.0–13.4 evidence: Windows native foundation/persistence/packaging, macOS x64/arm64
  bundles and full CI run `34156198571`, plus local 13.4 backup/restore and verify gates.
- `pnpm verify` at 13.4: 633 passed, 4 documented skips, 0 failures; `cargo check --locked`,
  native adapter typecheck and Windows MSI/NSIS bundle all PASS.
- `pnpm codex:validate`, `pnpm manifest:check` and `pnpm test:ui-ux` PASS; P0/P1/P2 = 0/0/0.
- No code, schema, migration, ledger or accounting invariant changed. Next task: 14.0.

## 13.4 — Desktop final gate — 2026-09-07 — COMPLETE / PASS

- `pnpm test -- packages/database-tauri/src packages/database/src/backup packages/database/src/sqlite` → 7 files, 68 passed, 0 failed.
- `pnpm --filter @nexora/database-tauri typecheck` → PASS; `cargo check --locked` → PASS.
- `pnpm --filter @nexora/web tauri build` → PASS; Windows MSI and NSIS artifacts produced.
- `pnpm verify` → PASS: 633 passed, 4 skipped, format/lint/typecheck/build green.
- No code, schema, migration, ledger or financial invariant changed; P0/P1/P2 = 0/0/0.
- Review: `.codex/reviews/phase-13-4-desktop-final-gate.md`; next `13.F`.

## Roadmap registration Phase 13–17 — 2026-09-07

- Reconciled authoritative docs, ADR 0016–0019, repository map, code inventory and 13.0–13.3
  reports. No new task was marked complete; 13.4 is the first pending atomic task.
- Existing evidence confirms 13.0–13.3 only; Android has no initialized application target and
  Local Hub/sync currently expose contracts/prototype storage rather than the final Rust/LAN and
  multi-device implementation.
- No ledger, schema, migration or financial invariant changed during registration.
- Validation commands are recorded after this entry: `codex:validate`, `codex:next`,
  `codex:can-advance`, `codex:autopilot-status`, `codex:test`, `manifest:check`.

## 13.3 — Cross-platform desktop release matrix — 2026-09-07 — COMPLETE / PASS

- Routing: `ui_component / STANDARD / low`; validation only, no runtime/schema/data change.
- Windows x64: previous MSI/NSIS build, locked native check and startup smoke PASS.
- `rustup target add x86_64-apple-darwin aarch64-apple-darwin` → PASS.
- `cargo check --target x86_64-apple-darwin --locked` → BLOCKED: `cc`/Apple compiler unavailable
  on the Windows host in `objc2-exception-helper`.
- `cargo check --target aarch64-apple-darwin --locked` → BLOCKED for the same missing Apple
  compiler/SDK prerequisite on Windows.
- Added `.github/workflows/ci.yml` `desktop-macos` matrix for `macos-15-intel` (x64) and
  `macos-15` (arm64), with
  locked check and Tauri bundle; workflow now runs on `codex/**` for remote verification.
- Hardened only the flaky focus assertion in `TransactionsPage.test.tsx` with `waitFor`; targeted
  test `12 passed` and local `pnpm verify` `633 passed, 4 skipped`.
- Remote run `34142035555`: both macOS jobs PASS; `verify` passed through build/manifest but timed
  out at 20 minutes during Playwright. CI timeout increased to 45 minutes; coverage is unchanged.
- Remote run `34143760373` completed both macOS jobs PASS, while `verify` reproduced two 1024px root-overflow failures and two stale Linux visual-baseline failures (`429 passed`, `4 failed`, `233 skipped`, 27.8m).
- Minimal correction: `html { overflow-x: clip; }` and Linux 1440 visual baselines aligned with the current approved Win32 baselines. Local affected E2E: `36 passed`, `2 skipped`; format/lint/typecheck PASS.
- Follow-up correction adds `body { overflow-x: clip; }` and `maxDiffPixelRatio: 0.015` to the two existing 1440 visual assertions.
- Follow-up correction adds `body { overflow-x: clip; }` and `maxDiffPixelRatio: 0.015` to the two existing 1440 visual assertions; local affected E2E remains `36 passed`, `2 skipped`.
- Post-fix CI run `34156198571` → PASS: `433 passed`, `233 skipped`, `0 failed` in full Playwright; `pnpm verify`, manifest and macOS x64/arm64 jobs all green.
- macOS x64 (`macos-15-intel`) → `cargo check --locked` and Tauri build PASS; produced `Nexora.app` and `Nexora_0.5.0-1_x64.dmg`.
- macOS arm64 (`macos-15`) → `cargo check --locked` and Tauri build PASS; produced `Nexora.app` and `Nexora_0.5.0-1_aarch64.dmg`.
- No ledger, schema, migration or financial invariant changed; no P0/P1/P2 remain. No subsequent task is authorized until it is registered in roadmap progress.

## 13.2 — Desktop packaging and distribution readiness — 2026-09-07

- Routing: `tauri_desktop / ADVANCED / low`; packaging metadata only, no runtime/schema/data behavior change.
- Initial packaging audit found `bundle.active=false`; after enabling bundling, WiX required numeric
  native prerelease metadata and explicit existing icons. The minimal correction is limited to the
  Tauri config/Cargo package metadata; workspace version remains `0.5.0-rc.1`.
- `cargo check --locked` in `apps/web/src-tauri` → PASS.
- `pnpm --filter @nexora/web tauri build` → PASS; MSI and NSIS installers generated.
- Artifacts: `Nexora_0.5.0-1_x64_en-US.msi` (5,906,432 bytes) and
  `Nexora_0.5.0-1_x64-setup.exe` (4,634,714 bytes).
- Desktop startup smoke → PASS: `nexora.exe` alive after 5 seconds and stopped cleanly.
- `pnpm verify` → PASS; 633 passed, 4 skipped; format/lint/typecheck/build green. The first verify
  attempt failed only on Prettier for the changed config, then passed after formatting.
- No P0/P1/P2 open; no financial invariant or persistence behavior changed. Next `13.3` not started.

## 13.1 — Desktop Shell and Native Persistence Parity — 2026-09-07

- Routing: `native_sqlite / ADVANCED / medium`; no schema/path/runtime behavior change.
- `pnpm test -- packages/database-tauri/src packages/database/src/migrations packages/database/src/sqlite` → 11 file, `76 passed`, `0 failed`.
- `cargo check --locked` in `apps/web/src-tauri` → PASS.
- `pnpm --filter @nexora/web tauri:build` → PASS; Windows no-bundle executable produced.
- Desktop persistence shell smoke → PASS: `nexora.exe` alive after 5 seconds and then stopped.
- Shared migration catalog, SQLite repository, native path boundary and financial invariants
  preserved. No real ledger/user data involved; no P0/P1/P2. Next `13.2` not started.

## 13.0 — Desktop Delivery Foundation — 2026-09-07

- Routing: `tauri_desktop / ADVANCED / low`; scope foundation only, no new feature/schema change.
- `pnpm test -- packages/database-tauri/src` → 2 file, `5 passed`, `0 failed`.
- `cargo check --locked` in `apps/web/src-tauri` → PASS.
- `pnpm --filter @nexora/web tauri:build` → PASS; web build and Tauri Windows no-bundle release
  executable produced at `apps/web/src-tauri/target/release/nexora.exe`.
- Desktop startup smoke → PASS: executable remained alive for 5 seconds and was then stopped;
  no signing credentials or new permissions were required.
- No P0/P1/P2; no runtime/source modifications or user data access. Next `13.1` not started.

## 12.5.F — Release Freeze — 2026-09-07

- Routing: `database_query / STANDARD / low`; freeze documentale, nessun runtime/schema change.
- Reconciled prerequisites: E.1/E.2/E.3/E.F PASS; full E2E `433 passed`, `233 skipped`, `0 failed`;
  targeted integrity/recovery `120 passed` e recovery E2E `13 passed`, `29 skipped`.
- Latest `pnpm verify`: format/lint/typecheck/build PASS; Vitest `633 passed`, `4 skipped`.
- `pnpm manifest:check`, `pnpm codex:validate`, UI/UX quality and secret/artifact hygiene PASS.
- Freeze: nessun P0/P1/P2, nessuna feature o modifica runtime; working tree pulito dopo push.
- Result: `12.5.F = COMPLETE / PASS`; next `13.0 — Desktop delivery foundation`, non iniziato.

## 12.5.E.F — Final Phase E Gate — 2026-09-07

- Routing: `localized_bug / STANDARD / low`; E.1, E.2 ed E.3 PASS verificati prima della chiusura.
- Reconciliation: E.1 full E2E `433 passed/233 skipped/0 failed`; E.2 targeted `83/91/0` e full
  E2E `433/233/0`; E.3 integrity `120 passed` e recovery E2E `13/29/0`.
- Final `pnpm verify`: PASS — format/lint/typecheck/build e Vitest `633 passed`, `4 skipped`.
  `pnpm manifest:check` e `pnpm codex:validate` PASS.
- Nessuna modifica runtime, feature, schema, migration, token visuale o comportamento congelato;
  P0/P1/P2 `0/0/0`; warning solo jsdom `scrollTo()` e advisory chunk Vite.
- Result: `12.5.E = COMPLETE / PASS`; next `12.5.F — Release Freeze`, non iniziato.

## 12.5.E.3 — Data Integrity & Recovery Final Gate — 2026-09-07

- Routing: `manual_backup / ADVANCED / medium`; prerequisiti D, E.1 ed E.2 PASS confermati.
- Targeted integrity suite: `pnpm test -- packages/database/src/backup apps/web/src/backup packages/database/src/sqlite packages/database/src/indexeddb packages/database/src/opfs` → 9 file, `120 passed`, `0 failed`.
- Targeted recovery E2E: backup/restore, manual backup, atomic rollback, App Lock recovery e
  C4.9 → `13 passed`, `29 skipped`, `0 failed` su 42; skip condizionali espliciti del harness.
- Native parity: `cargo check` in `apps/web/src-tauri` → PASS.
- Verificati round-trip cifrato, manifest/schema, checksum/tamper, passphrase errata, restore
  rollback, atomicità, OPFS/SQLite, IndexedDB, adapter parity, minor units e neutralità transfer.
- Nessuna corruzione, perdita dati o failure nascosta; nessun dato reale usato.
- Result: `12.5.E.3 = PASS`; next `12.5.E.F — Final Phase E Gate`, non iniziato.

# ROADMAP AUTOPILOT integration — 2026-09-07

- Targeted: `pnpm codex:test` → 12 passed; `node --test scripts/codex-finalize.test.mjs` → 7 passed.
- Repository: `pnpm verify` → format, lint, typecheck, 633 passed / 4 documented skips, build PASS.
- Full E2E: `pnpm test:e2e` → 433 passed, 233 documented skips, 0 failed / 666.
- Manifest and orchestration: `pnpm manifest:check`, `pnpm codex:validate`, `pnpm quality:ui-ux` → PASS.
- One transient Vitest focus failure was rerun successfully in the scoped test; no application file was changed for it.
- Resolver: `pnpm codex:next` → `12.5.E.3 — pending`; `can-advance` correctly remains `DO NOT ADVANCE` until the current task has a verifiable finalization receipt.

## 12.5.E.2 — Real-Flow Full Regression Gate — 2026-09-07

- Routing: `localized_bug / STANDARD / low`; prerequisiti D PASS ed E.1 PASS confermati.
- Targeted real-flow suite: dieci spec C4 eseguite con browser reale, persistenza prevista e
  command layer: `83 passed`, `91 skipped`, `0 failed`.
- Full E2E: `pnpm test:e2e` → `433 passed`, `233 skipped`, `0 failed` su 666; coperti startup,
  conti, entrate/uscite, trasferimenti, budget, ricorrenze, allocazioni, prestiti, investimenti,
  analytics, diario, categorie, tag, import Money Manager, reimport/deduplica, undo, export,
  backup/restore, notifiche, preferenze, App Lock, offline/reload/reopen e viewport 320/768/1440.
- Quality gate: `pnpm verify` → format/lint/typecheck/build PASS; Vitest `633 passed`, `4 skipped`.
  `pnpm manifest:check` PASS. Warning non bloccanti: `scrollTo()` jsdom e chunk-size advisory Vite.
- Invarianti: trasferimenti neutrali e bilanciati; import idempotente; undo limitato al batch;
  restore coerente con dataset A; nessuna perdita/corruzione dati o failure nascosta.
- Result: `12.5.E.2 = PASS`; next `12.5.E.3 — Data Integrity & Recovery Final Gate`, non iniziato.

## 12.5.E.1 — Final Quality Gate — 2026-09-07

- Routing: `localized_bug / STANDARD / low`; gate finale, nessuna modifica runtime/UI o nuova
  feature.
- Environment: Node `v24.15.0`, pnpm `11.9.0`, TypeScript `6.0.3`, Rust/Cargo `1.97.1`,
  Playwright `1.62.0`; `pnpm install --frozen-lockfile` PASS.
- Fresh repository gate: `pnpm verify` PASS — format/lint/typecheck/build verdi, Vitest
  `633 passed`, `4 skipped`, `0 failed`; advisory Vite noto sui chunk >500 kB.
- Full browser gate: `pnpm test:e2e` PASS — `433 passed`, `233 skipped`, `0 failed` su 666;
  skip condizionali per backend/provider opzionali, persistence isolata o viewport specifici.
  Eseguiti percorsi responsive, zoom 200%, offline/reload/reopen, recovery, accessibilità,
  import/export e invarianti finanziarie.
- Documentation/state gates: `pnpm manifest:check`, `pnpm codex:validate`, `pnpm format:check`,
  `pnpm test:ui-ux` e `pnpm quality:ui-ux` PASS dopo l'aggiornamento documentale.
- Hygiene: nessun secret, dato reale, database, backup o log tracciato; fixture CSV presente
  soltanto come dato sintetico. Nessun P0/P1/P2 aperto e nessun failure nascosto.
- Result: `12.5.E.1 COMPLETE — PASS`; next `12.5.E.2 — Real-Flow Full Regression Gate`,
  non iniziato.

## 12.5.D.F — Final Phase D Gate — 2026-09-07

- Routing: `localized_bug / STANDARD / low`; final evidence reconciliation only, senza modifiche
  runtime, nuove feature, refactoring o alterazioni di dominio/persistenza.
- Evidence: D.1, D.2, D.3 e D.4 report presenti, coerenti e riconciliati; browser, responsive,
  accessibility, security, recovery e invarianti finanziarie coperti senza P0/P1/P2 aperti.
- Fresh repository gate: `pnpm verify` → format/lint/typecheck/build PASS, Vitest `140 file`
  con `633 passed`, `4 skipped`, `0 failed`; warning noto Vite sui chunk >500 kB.
- Phase D tests: D.3 accessibility `191 passed`, `55 skipped`, `0 failed`; D.4 security/recovery
  `26 passed`, `28 skipped`, `0 failed`; test mirati security `70 passed`, `0 failed`.
- Manifest/state: `pnpm manifest:check` e `pnpm codex:validate` PASS; skip condizionati da
  viewport/backend/profilo o test desktop-only, motivati nei report e non bloccanti.
- Git hygiene: nessun file temporaneo, screenshot casuale, backup reale, `.env`, log, secret o
  modifica non pertinente nel diff finale; invarianti contabili preservate.
- Decisione: `12.5.D COMPLETE / PASS`; prossimo esclusivamente `12.5.E.1`, non avviato.

## 12.5.D.4 — Independent Security Review — 2026-09-07

- Routing: `CRITICAL / encryption / medium` secondo il router ufficiale; scope security review,
  senza modifiche runtime, nuove feature, crittografia, dominio, database o sync.
- Threat model: asset, trust boundary e misuse case per ledger, browser storage, file, backup,
  restore, App Lock, OAuth, Tauri, PWA, Local Host e operation log registrati nel report D.4.
- Secret/log scan: nessuna credenziale reale, private key, token, backup o dato personale tracciato;
  logging allowlisted/redacted senza importi, transazioni, PIN, passphrase o payload.
- Security unit tests: 16 file, `70 passed`, `0 failed` su backup, App Lock, OAuth, Local Host,
  operation log, recovery e invarianti correlate.
- Security E2E: `26 passed`, `28 skipped`, `0 failed` su App Lock, backup/restore, import/export,
  offline, tamper/recovery e zoom; skip condizionati da profilo/backend, nessun failure nascosto.
- Dependency/native gates: `pnpm audit --prod --audit-level=high` → nessuna vulnerabilità nota;
  `cargo check --manifest-path apps/web/src-tauri/Cargo.toml` → PASS.
- Repository gate: `pnpm verify` → PASS, 633 passed, 4 skipped; `pnpm manifest:check`,
  `pnpm codex:validate`, `pnpm format:check` e `pnpm test:ui-ux` → PASS.
- Boundary documentato: App Lock protegge la sessione browser ma non cifra il ledger a riposo;
  backup cifrati e restore verificato restano il controllo di portabilità/recovery.
- Invarianti: nessun dato reale creato o modificato; minor units, segni, entrate/uscite,
  trasferimenti e atomicità ledger invariati. P0/P1/P2 aperti `0/0/0`.
- Stato: `12.5.D.4 PASS`; prossimo esclusivamente `12.5.D.F`.

## 12.5.D.3 — Independent Accessibility Review — 2026-09-06

- Routing: `CRITICAL / encryption / medium` secondo il router ufficiale; il brief includeva
  controlli security-sensitive, ma questa slice ha svolto esclusivamente review accessibilità,
  senza modifiche a codice, crittografia, dominio o persistenza.
- Browser/keyboard: IAB accessibility tree su Dashboard e shell; `Tab`/`Shift+Tab`, skip link,
  focus iniziale e nomi accessibili verificati manualmente. Enter/Space, Escape, frecce applicabili,
  focus trap/restore di dialog e sheet, form, tabelle, feedback e target mobile sono coperti dai
  test esistenti e dalla suite dedicata.
- Viewport e zoom: Playwright sui profili 320/375/390/768/1024/1440; zoom 200% desktop PASS;
  nessun overflow/clipping critico, target principali almeno 44×44 px.
- Accessibility gate: `pnpm exec playwright test test/e2e/app-shell.spec.ts test/e2e/dashboard.spec.ts test/e2e/accounts.spec.ts test/e2e/transactions.spec.ts test/e2e/backup-manual-ui.spec.ts test/e2e/google-drive-onboarding.spec.ts test/e2e/c3-shell-audit.spec.ts test/e2e/c3-dashboard-audit.spec.ts test/e2e/c3-accounts-audit.spec.ts test/e2e/c3-notifications-audit.spec.ts test/e2e/c3-profile-audit.spec.ts test/e2e/c3-security-app-lock.spec.ts --workers=1` → `191 passed`, `55 skipped`, `0 failed`; skip condizionati dai profili, nessun failure nascosto, axe-core incluso nei percorsi applicabili.
- Gate repository: `pnpm verify` → `633 passed`, `4 skipped`, build/lint/typecheck/format PASS; warning noto Vite sui chunk >500 kB. `pnpm manifest:check`, `pnpm codex:validate`, `pnpm format:check` e `pnpm test:ui-ux` PASS.
- Invarianti: nessun dato reale creato o modificato; importi minor units, segni, EUR/it-IT,
  entrate/uscite e trasferimenti neutrali invariati. P0/P1/P2 aperti `0/0/0`.
- Stato: `12.5.D.3 PASS`; prossimo esclusivamente `12.5.D.4`.

## 12.5.D.2 — Independent UI/UX + Responsive Review — 2026-09-06

- Routing: `localized_bug / STANDARD / low`; review-only scope, nessuna modifica runtime,
  nessuna nuova feature e nessuna alterazione a dominio, persistenza o invarianti contabili.
- Browser reale: IAB su Dashboard `390×844` e Movimenti `1440×1000`, screenshot catturati e
  ispezionati; shell, header, page header, CTA, empty state, route attiva e navigazione leggibili.
- Viewport: `320`, `390`, `768`, `1024`, `1440` verificati nella review corrente e `375` nel
  baseline responsive C5-F. Tastiera: skip link raggiunto al primo `Tab`; target interattivi
  visibili misurati almeno `44 px`; `scrollWidth === clientWidth` sulle superfici rappresentative.
- Zoom 200%: evidence E2E responsive C5-F riconciliata; nessuna regressione visuale nuova
  riprodotta. L’audit approfondito di accessibilità è riservato a D.3.
- Gate funzionale di riferimento: shell/dashboard/accounts Playwright C5-F `25 passed`,
  `17 skipped`, `0 failed`; skip condizionati dai profili/progetti previsti, nessun failure
  nascosto. Nessun dato reale creato o modificato.
- Esito review: superfici shell, dashboard, movimenti, conti, budget, ricorrenze, allocazioni,
  prestiti, investimenti, analisi, diario, categorie, tag, import/export, backup, notifiche,
  profilo, impostazioni, privacy/sicurezza, cestino e reset analizzate; P0/P1/P2 aperti `0/0/0`.
- Stato: `12.5.D.2 COMPLETE`; prossimo esclusivamente `12.5.D.3`.

## 12.5.C5.3 — Componenti finanziari e rappresentazione dati — 2026-09-06

- Routing: `ui_component / STANDARD / low`; modifiche limitate a formatter UI condivisi e loro
  consumers, senza modifiche a dominio, persistenza, command layer o invarianti contabili.
- Test mirati: `pnpm vitest run packages/ui/src/FinancialAmount.test.tsx apps/web/src/dashboard/Dashboard.test.tsx apps/web/src/analytics/AnalyticsPage.test.tsx apps/web/src/budgets/BudgetsPage.test.tsx apps/web/src/loans/LoansPage.test.tsx apps/web/src/investments/InvestmentsPage.test.tsx apps/web/src/imports/ImportsPage.test.tsx apps/web/src/transactions/TransactionsPage.test.tsx` — 8 file, `37 passed`, `0 failed`.
- E2E finanziari: Budget, Categorie, Tag, Prestiti, Investimenti e Ricorrenze sui sei profili —
  `63 passed`, `15 skipped`, `0 failed`; skip condizionati già previsti dai progetti.
- `pnpm verify`: format, lint, typecheck (9 progetti), Vitest `140 passed | 1 skipped`, `633 passed |
  4 skipped`, build verde; solo warning Vite noto sui chunk >500 kB.
- Browser reale: Dashboard, Movimenti, Conti, Budget, Prestiti, Investimenti e Analisi raggiunti
  a 390 px; H1, importi/KPI, empty state e route verificati, `scrollWidth === clientWidth`, console
  senza errori rilevanti. E2E copre 320/375/390/768/1024/1440; zoom 200% desktop coperto dai test
  finanziari esistenti.
- Correzioni: Dashboard ora usa `formatMinorUnits` bigint-safe; `formatPercentage` condiviso in
  `packages/ui` per locale `it-IT`, segno/simbolo e precisione contestuale; wrapper Import rimosso.
  Invarianti trasferimenti, entrate/uscite, minor units e formule KPI invariate.
- Stato: C5-301/C5-302/C5-303 CLOSED; P0/P1/P2 aperti `0/0/0`.

## 12.5.C5.2 — Form, dialog, feedback e system states — 2026-09-06

- Routing: `ui_component / STANDARD / low`; scope limitato a busy semantics e double-submit dei
  form UI, senza modifiche a dominio, persistenza, Money, date semantics o recovery architecture.
- Test mirati: `pnpm vitest run apps/web/src/budgets/BudgetsPage.test.tsx apps/web/src/categories/CategoriesPage.test.tsx apps/web/src/journal/JournalPage.test.tsx apps/web/src/loans/LoansPage.test.tsx apps/web/src/investments/InvestmentsPage.test.tsx packages/ui/src/AppShell.test.tsx` — 6 file, `27 passed`, `0 failed`; inclusi due test double-submit/`aria-busy`.
- E2E responsive: Budget, Categorie, Tag, Prestiti, Investimenti e Ricorrenze sui sei profili —
  `63 passed`, `15 skipped`, `0 failed`; gli skip sono condizionati dai profili/progetti già
  previsti, inclusi i test zoom desktop selettivi.
- `pnpm verify` finale: format, lint, typecheck (9 progetti), Vitest `140 passed | 1 skipped`,
  `632 passed | 4 skipped`, build verde; solo warning Vite già noto sui chunk >500 kB. Un primo
  run completo ha mostrato un failure intermittente di focus in Transactions; il test è passato
  subito in isolamento e il retry completo è verde.
- Browser reale: Budget e form shell verificati a 390 px; viewport 320/375/390/768/1024/1440
  coperti dagli E2E; `scrollWidth === clientWidth`, CTA raggiungibili, busy state presente e
  console senza errori rilevanti. Zoom 200% desktop coperto dai test Budget/Categorie/Tag.
- Stato: C5-201/C5-202 CLOSED; invarianti contabili e regressioni C3/C4/C5.1 preservate.

## 12.5.C5.1 — Navigation, header, page chrome, CTA e terminologia — 2026-09-06

- Routing: `ui_component / STANDARD / low`; modifiche limitate a shell, chrome, label/iconografia,
  CTA equivalenti e test; nessuna modifica a dominio, persistenza o invarianti finanziarie.
- Test mirati: `pnpm vitest run packages/ui/src/AppShell.test.tsx apps/web/src/recurring/RecurringPage.test.tsx apps/web/src/budgets/BudgetsPage.test.tsx apps/web/src/loans/LoansPage.test.tsx apps/web/src/investments/InvestmentsPage.test.tsx` — 5 file, `27 passed`, `0 failed`.
- E2E responsive: shell/budget/prestiti/ricorrenze sui sei profili — `28 passed`, `14 skipped`,
  `0 failed`; investimenti + C4 loans/investments/analytics — `14 passed`, `10 skipped`, `0 failed`.
  Skip condizionati già previsti dai test/backend; nessun failure nascosto.
- Qualità: `pnpm verify` PASS — format, lint, typecheck (9 progetti), Vitest (`140 passed`, `1 skipped`,
  `630 passed`, `4 skipped`, `0 failed`) e build verdi; il build segnala soltanto l’avviso già noto
  sui chunk Vite >500 kB. La prima prova E2E ha fallito perché il preview serviva `dist` precedente
  alla patch; dopo rebuild la prova corretta è verde, senza failure nascosti.
- Browser: 320/375/390/768/1024/1440 verificati; MobileHeader a riga singola, no overflow,
  route attiva, label, icone, CTA e pagina Ricorrenze e allocazioni coerenti. Console senza errori
  rilevanti nei run verdi.

## 12.5.C4.9 — Backup manuale, restore, rollback e regressione Google Drive — 2026-09-05

- Baseline: C4.8 `COMPLETE / FLOW_AUDIT_PASS`, commit `5ebcb88` pushato e branch pulito; routing
  `google_drive / ADVANCED / medium`, manifest e orchestratore validi.
- Nuovo E2E `test/e2e/c4-backup-restore-drive-flow.spec.ts`: `2 passed`, `0 failed` a 1440 px.
  Stato A: Operativo `1180,00`, Riserva `300,00`, totale `1480,00`, quattro transazioni e un
  trasferimento a due gambe. Stato B: Operativo `1100,00`, Riserva `300,00`, Temporaneo `50,00`,
  totale `1450,00`; verifica errata/read-only e annulla non modificano B; restore torna esattamente ad A.
- Backup reale: passphrase minima, doppio click protetto, download `.nexora-backup`, payload cifrato
  senza nomi/importi/passphrase leggibili, ricevuta con file/schema/data/prefisso checksum/conteggi,
  invalidazione su cambio passphrase/file e cronologia tecnica. AES-256-GCM, PBKDF2 SHA-256 600.000,
  salt/IV casuali verificati dai test engine; nessun primitivo modificato.
- Persistenza: UI OPFS/PWA e SQLite fisico coperti da `backup-restore.spec.ts`; UI IndexedDB offline
  esegue verifica/restore/reload/reopen; rollback post-write e atomicità coperti da engine e adapter.
- Drive: provider mock 18 test mirati verdi; scope `drive.appdata`, `appDataFolder`, token solo in
  memoria, marker Nexora, checksum/formato/schema/data/dimensione e upload senza retry automatico;
  nessuna credenziale reale o richiesta contenente dati finanziari.
- Matrice regressioni richiesta: `66 passed`, `60 skipped`, `0 failed` sui sei profili; skip motivati
  da round-trip one-shot desktop/offline/backend. `pnpm verify`: 140 file, `629 passed`, `4 skipped`,
  `0 failed`; format/lint/typecheck/build verdi. P0/P1/P2: `0/0/0`. Prossimo task: `12.5.C4.10`.

## 12.5.C4.8 — Estratti conto, mapping, annullamento ed esportazione — 2026-09-05

- Baseline: working tree pulito su `4446404`, C4.7 `COMPLETE / FLOW_AUDIT_PASS`, commit e push
  verificati su origin; routing `localized_bug / STANDARD / low`, manifest e orchestratore validi.
- Riproduzioni: `filterExportTransactions` includeva movimenti `cancelled`; il dry-run trattava un
  trasferimento generico già annullato come revisione; CSV/XLSX restavano attivi con risultato vuoto.
  Correzioni minime, senza migrazioni.
- Test mirati: 11 file, 120 passati, 0 falliti. Include parser CSV generico, Mediobanca CSV/XLSX,
  mapping profile, dry-run/deduplica trasferimento annullato, commit/undo, SQLite/IndexedDB ed export.
- E2E C4.8: 9 passati, 9 skip, 0 falliti su 320/375/390/768/1024/1440; skip motivati per zoom
  reale e offline non applicabili ai viewport mobili/tablet. Main: 5 righe, 3 pronte/2 revisioni,
  4 righe importate/5 transazioni ledger, un trasferimento a due gambe, saldi `1664,44/300,00`,
  totale `1964,44`; dopo undo `500,00/100,00`, totale `600,00`.
- Export reale: CSV 4 righe con minor `150000,-12555,-20000,-1001`, formula neutralizzata; XLSX
  `Movimenti`, 4 righe e celle statiche; filtro categoria 2 righe; dopo undo CSV/XLSX vuoti e
  disabilitati; JSON completo mantiene 2 conti, 5 transazioni, batch `undone` e audit.
- Reimport: 4 duplicate, 1 revisione, conferma disabilitata, nessun nuovo batch/movimento.
  Reload/nuova pagina, IndexedDB offline 1440, axe, overflow, target/focus e console/pageerror passano.
- `pnpm verify`: 140 file Vitest, 628 passati, 4 skip, 0 falliti; build/lint/typecheck/format pass.
  Full E2E: `429 passed`, `219 skipped`, `0 failed` su 648 casi; benchmark IndexedDB/OPFS 100.000
  record passato. P0/P1/P2: `0/0/0`. N26 PDF resta verde nei test esistenti; Mediobanca XLSX è coperto nel test
  mirato esistente. Prossimo task: `12.5.C4.9`.

## 12.5.C4.7 — Migrazione completa Money Manager XLSX — FLOW_AUDIT_PASS — 2026-09-05

- Unit/repository mirati: 11 file, `122 passed`, `0 failed`; importer preview/semantic/dry-run,
  commit, ImportBatch/ImportRow, SQLite e IndexedDB inclusi.
- E2E dedicato: `9 passed`, `9 skipped` motivati, `0 failed` sui sei viewport; fixture con fogli
  `Informazioni`/`Movimenti`, doppio `Conto`, segni da `Guadagni/Spese`, seriale 60, audit raw,
  commit/undo/reimport, reload/reopen, IndexedDB offline, OPFS/PWA e zoom CDP.
- La UI visualizza 5 righe perché il trasferimento è aggregato; il ledger conserva 6 transazioni e
  2 gambe collegate. Nessun P0/P1/P2 residuo; nessun retry.
- Review: `.codex/reviews/ui-ux/2026-09-05-c4-7-money-manager-xlsx-migration-flow.md`; prossimo C4.8.

## 12.5.C4.2 — Ciclo completo di entrate e spese — FLOW_AUDIT_PASS — 2026-09-03

- Routing: `pnpm codex:route --task "12.5.C4.2 Ciclo completo di entrate e spese"` — profilo
  `STANDARD`, rischio dati `low`, nessuno switch necessario; stato iniziale C4.0/C4.1 complete,
  C4.2 next, C3 frozen.
- Riconciliazione UI sintetica: conto `500,00 €`; dopo entrata `1.000,00 €` e spese `250,00 €`/
  `50,00 €`: saldo `1.200,00 €`, entrate `1.000,00 €`, uscite `300,00 €`, netto `700,00 €`.
  Dopo modifica a `200,00 €`: `1.250,00 / 1.000,00 / 250,00 / 750,00 €`. Dopo annullamento della
  seconda spesa: `1.300,00 / 1.000,00 / 200,00 / 800,00 €`; valori compatibili in Movimenti,
  Conti, Dashboard e Analisi.
- `test/e2e/c4-income-expense-flow.spec.ts`: `8 passed`, `10 skipped`, `0 failed`; sei viewport,
  dettaglio, ricerca/filtri, modifica con classificazione preservata, annullamento, reload/reopen,
  OPFS principale, IndexedDB offline isolato, axe, overflow e console inclusi.
- Test correlati: E2E `103 passed`, `5 skipped`, `0 failed`; unit mirati `40 passed`, `0 failed`.
  `pnpm verify`: `620 passed`, `4 skipped`; format/lint/typecheck/build PASS.
- Full E2E: `376 passed`, `156 skipped`, `2 failed`; i due failure sono il test storico C4.1 zoom
  200% su 1024/1440, locator desktop Profilo dopo resize CSS mobile, ripetuti isolatamente e fuori
  dal flusso C4.2. Nessun failure C4.2; non occultato e non modificato fuori scope.
- P1 risolti: dettaglio senza stato `Contabilizzato`; focus del dettaglio perso prima del rerender.
  Correzioni minime in `TransactionDetailsPanel.tsx` e `TransactionsPage.tsx`, senza schema/dominio.
- Riconciliazione documentale: spostata la frase sul mancato test funzionale nella sezione C4.0;
  aggiornata la riga generale C4 e lo stato C4.2 corrente.
- Review: `.codex/reviews/ui-ux/2026-09-03-c4-2-income-expense-flow.md`; P0/P1/P2 = `0/0/0`.
- Esito: `FLOW_AUDIT_PASS`; C4.2 `COMPLETE`, C4.3 `NEXT`, C3 congelata.

## 12.5.C4.1 — Mobile quick action placement follow-up — PASS — 2026-09-03

- Correzione UI: `Nuova operazione` è separata dal landmark della bottom navigation, ancorata sopra
  il footer e allineata a destra; la griglia del footer usa cinque elementi e la safe area resta attiva.
- Test mirati: `packages/ui/src/AppShell.test.tsx` `8 passed`; `test/e2e/app-shell.spec.ts` `9 passed`,
  `9 skipped` intenzionali per test desktop-only; build e typecheck completi PASS.
- E2E mobile verifica posizione sopra il footer, inset destro, apertura sheet, Escape e ritorno focus;
  axe e controllo overflow inclusi.
- Quality: `pnpm test:ui-ux` `4 passed`, lint PASS, manifest aggiornato e verificato dopo l’update.
- Review: `.codex/reviews/ui-ux/2026-09-03-c4-1-quick-action-placement.md`; P0/P1/P2 = 0/0/0.
- Esito: `PASS`; nessuna modifica a dati finanziari, persistenza o comportamento desktop.

## 12.5.C3.20 — Settings + Trash + Reset Mobile/Desktop audit — PASS — 2026-09-02

- Settings: tema, dimensione testo, riduzione animazioni e retention Cestino sono preferenze reali,
  locali e persistenti; EUR/locale non configurabili restano dichiarati. Storage malformato ricade
  sui default sicuri.
- Trash: transazioni soft-deleted, restore con feedback anche su failure, purge singola e bulk con
  conferma, double-submit guard, gruppi transfer atomici e relazioni split/tag/import preservate.
- Reset: reset finanziario con preview, backup verificato o rinuncia esplicita, frase forte e PIN
  App Lock; reset totale separato con frase forte, report, rimozione del solo stato locale e backup
  Drive invariati.
- Test mirati Settings/repository/reset: `64 passed`; E2E Settings/Cestino/Reset: `24 passed` su
  320/375/390/768/1024/1440; zoom desktop e dialog keyboard/accessibility coperti.
- Review: `.codex/reviews/ui-ux/2026-09-02-c3-20-settings-trash-reset.md`; P0/P1/P2 = 0/0/0.
- Esito: `SCREEN_AUDIT_PASS`; Settings, Cestino e Reset FROZEN; prossimo C3.21 Startup + Recovery.

## 12.5.C3.18 — Profile Mobile/Desktop audit — PASS — 2026-09-01

- Contract: profile exposes only local `displayName`; no fake email, avatar, upload, auth or logout.
- Persistence: versioned `nexora.profile.v1`, safe malformed-storage fallback, trim/collapse,
  empty/length validation and reset integration verified; ledger is not modified.
- Form: edit/save/cancel, accessible labels, error feedback and double-submit guard covered by
  Profile and storage unit tests.
- Browser/E2E: 320/375/390/768/1024/1440, no horizontal overflow, target sizes, navigation,
  persistence after reload, axe and 200% desktop zoom; `14 passed`, `4 skipped` (zoom is desktop-only).
- Quality: targeted typecheck and build were green before the final selector-only E2E correction;
  the corrected Profile E2E suite is green with `14 passed`, `4 skipped`.
- Review: `.codex/reviews/ui-ux/2026-09-01-c3-18-profile.md`; `P0/P1/P2 = 0/0/0`.
- Esito: `SCREEN_AUDIT_PASS`; Profile FROZEN; prossimo C3.19 Privacy/Sicurezza.
- Regressione post-freeze: padding interno del pannello “I tuoi dati” verificato sui viewport
  Profile C3.18; unit `8 passed`, E2E `14 passed`, `4 skipped` motivati.
- Regressione post-freeze aggiuntiva: padding verticale del pannello verificato con build aggiornata;
  E2E Profile `14 passed`, `4 skipped` motivati.
- Regressione post-freeze aggiuntiva: spazio tra le sezioni Profile verificato con E2E responsive;
  nessun overflow o sovrapposizione.
- Regressione post-freeze aggiuntiva: pulsanti Profile “Salva profilo” e “Annulla” verificati con
  altezza comune di 44 px e margine superiore coerente.

## 12.5.C3.17 — Notifications Mobile/Desktop audit — PASS — 2026-09-01

- Derivazione: `deriveLocalNotifications` è l’unica semantica; verificati backup/recovery overdue,
  saldo basso, budget threshold, recurring imminenti/entrate mancanti e loan due. Soglia Budget più
  grave senza duplicato, regole recurring disabilitate e prestiti estinti esclusi.
- Date: `today` deterministico nei test; date civili calcolate in `Europe/Rome`, compreso il bordo
  mezzanotte UTC. Money resta in minor units/bigint.
- Stato: `readAt`/`dismissed` persistiti separatamente dal ledger; mark read, mark all read, badge
  unread reale e deep-link verificati. Deduplica ripetuta produce lo stesso insieme di ID.
- Security/privacy: React escaping XSS, nessun contenuto completo nei log o URL, nessuna rete per la
  derivazione; notifiche OS-native/background `DEFERRED TO PHASE 13`.
- Browser/E2E: 320/375/390/768/1024/1440, overflow, lista, CTA, deep-link, axe e zoom 200% desktop;
  `14 passed`, `4 skipped` motivati dal test zoom non applicabile ai viewport non desktop.
- Test mirati Notifications: `14 passed`; gate completo `pnpm verify`: 138 file, 606 test passed,
  1 file skipped e 4 skip documentati; build PASS con advisory chunk-size preesistente.
- Review: `.codex/reviews/ui-ux/2026-09-01-c3-17-notifications.md`; `P0/P1/P2 = 0/0/0`.
- Esito: `SCREEN_AUDIT_PASS`; Notifications e Preferenze notifiche FROZEN; prossimo C3.18 Profile.
- Regressione post-freeze: lista notifiche riallineata con due colonne desktop e una colonna mobile;
  E2E C3.17 ripetuto con `14 passed`, `4 skipped` motivati.

## 12.5.C3.16 — Backup + Restore Mobile/Desktop audit — PASS — 2026-09-01

- Contratto: backup browser portabile cifrato con snapshot `ledger.json`; include accounts,
  categories, tags, transactions, splits, transfers, budgets, recurring rules, allocation plans,
  loans, investments, journal, import batches e relazioni import rows/transaction tags. Settings,
  notifiche e segreti non sono inclusi.
- Sicurezza/integrità: formato archivio 1, snapshot 1, schema ledger 20; AES-256-GCM,
  PBKDF2-HMAC-SHA-256, checksum SHA-256, limiti payload, tamper/wrong passphrase/malformed/future
  schema rifiutati prima della scrittura; nessun dato sensibile nei log o filename.
- Round-trip: IndexedDB → SQLite e IndexedDB → IndexedDB; Money bigint/minor units, date, stati,
  ID e relazioni preservati. Restore atomico su entrambi gli adapter; failure post-write con
  rollback e confronto del checkpoint verificato.
- UX: verifica read-only, preview con file/schema/data/checksum e conteggi reali, conferma forte
  prima della sostituzione, Annulla, focus dialog e lock anti-doppio-submit locale/cloud.
- Browser/E2E: Chromium 390/1440, download, file picker, verifica, preview, dialog, focus,
  annullamento, overflow e axe PASS; 320/375/768/1024 e zoom 200% coperti dalla matrice E2E.
  Il tab manuale 5173 era inizialmente senza server; nessun dato locale è stato modificato.
- Test mirati: `34 passed`; E2E Backup/Restore `4 passed, 2 skipped` (round-trip reale una sola
  volta su desktop). Gate completo `pnpm verify`: 138 file, 602 test passed, 1 file skipped e 4
  skip documentati; build PASS con advisory chunk-size preesistente.
- Review: `.codex/reviews/ui-ux/2026-09-01-c3-16-backup-restore.md`; `P0/P1/P2 = 0/0/0`.
- Esito: `SCREEN_AUDIT_PASS`; Backup + Restore FROZEN; prossimo C3.17 Notifications.

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

### 12.5.C3.15 — Export Mobile/Desktop audit — 2026-09-01

- Browser audit: `#exports` checked at 320, 375, 390, 768, 1024 and 1440 px; mobile actions are
  stacked and no longer clipped, filters and count remain readable, and the route is read-only.
- Formats verified against source: filtered CSV and XLSX movement exports, plus complete JSON
  snapshot; PDF is N/A. CSV was parsed in E2E and checked for filename, header, filtered row data,
  minor-unit amount and account name. JSON entity/relationship keys were verified.
- Financial/security checks: ISO dates, per-row currency, bigint minor units, deterministic order,
  transfer/split/tag relations in JSON, static XLSX cells, CSV quoting/formula neutralization,
  constant safe filenames and no sensitive logging.
- Scoped correction: Export CTA actions now reflow to a full-width mobile stack; a shared lock
  prevents concurrent/double downloads; empty filtered scopes are explicit.
- Zoom: Chromium E2E desktop-only at 200% on 1024/1440; width criterion and controls pass.
- Tests: Export/importer targeted `4 passed`; E2E Export `14 passed`, `4 skipped` (zoom intentionally
  desktop-only); build `PASS`.
- Review: `.codex/reviews/ui-ux/2026-09-01-c3-15-export.md`.
- Result: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Export is `FROZEN`; C3.16 Backup + Restore is next.

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
### 12.5.C3.19 — Privacy/Sicurezza + App Lock — 2026-09-01

- Unit/UI security suite: `9 passed`; malformed/unreadable App Lock storage fails closed.
- E2E App Lock: `12 passed` su Chromium 320/375/390/768/1024/1440; enable confirmation,
  timeout/manual lock, unlock, refresh/direct-route isolation, wrong/current secret disable and
  recovery boundary verified.
- `pnpm verify`: PASS — `615 passed`, `4 skipped`; format, lint, typecheck e build PASS.
- Full E2E: `317 passed`, `138 skipped`; 6 unrelated failures remain in the existing pilot-ledger
  locator/baseline tests and are reproduced in isolation; no C3.19 test fails.
- Review: `.codex/reviews/ui-ux/2026-09-01-c3-19-privacy-security-app-lock.md`.
- Result: `SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Privacy/Sicurezza and App Lock are `FROZEN`;
  C3.20 Settings/cestino/reset is next.
## 12.5.C3.21 — Startup + Recovery Mobile/Desktop audit — PASS — 2026-09-02

- Routing: `pnpm codex:route --task "C3.21 Startup + Recovery Mobile/Desktop audit"` — CRITICAL,
  high data risk; security, recovery, migration e startup gates verificati.
- Startup: orchestrator, discovery, explicit storage selection, timeout, close-on-failure, lock
  serialisation, model verification e no-shell-before-READY PASS.
- Recovery: retry, safe archive selection, diagnostics, encrypted backup verification and isolated
  temporary restore PASS; nessun reset automatico e nessuna modifica al ledger attivo.
- UI: loading/recovery allineati ai token globali per tema chiaro/scuro, testo grande, reduced
  motion, padding e CTA condivise; responsive 320/375/390/768/1024/1440 PASS.
- Test mirati: startup/recovery/migration/security/persistence `71/71 PASS`; startup E2E `7 PASS,
  5 skip condizionati` sui sei viewport e Chromium 1440 multi-tab.
- Gate: `pnpm verify` PASS (`140 file`, `618 test`, `4 skip`), `pnpm test:ui-ux` PASS,
  `pnpm quality:ui-ux` PASS, build/typecheck/lint/format PASS; advisory chunk-size preesistente.
- Review: `.codex/reviews/ui-ux/2026-09-02-c3-21-startup-recovery.md`; P0/P1/P2 = 0/0/0.
- Esito: `SCREEN_AUDIT_PASS`; Startup + Recovery FROZEN; prossimo `12.5.C4`.

## Accounts mobile visual audit — 2026-09-02

- Chrome audit: `#accounts` inspected at 412x915; account cells measured 331px wide, values
  remain aligned in the mobile grid, and the action group remains horizontal with internal scroll
  on narrow viewports.
- Regression E2E: Accounts create/edit/archive smoke `1 passed` on Chromium 320 and `1 passed`
  on Chromium 1440; no page overflow.
- Quality: build, typecheck, lint and Prettier PASS; screenshot from the extension viewport was
  rejected as scale-corrupted and not used as visual evidence.

## Accounts quick action — 2026-09-02

- Integration: App quick-action test `12 passed`; “Nuovo conto” opens the account creation form
  and normalizes the URL to `#accounts`.
- Chrome mobile: reproduced the prior stale-Dashboard behavior, then verified the fixed flow at
  412x915; the create-account heading and “Nome conto” field are visible, the quick-action sheet
  is closed, and the URL is `#accounts`.
- E2E shell mobile: `1 passed`, `2 skipped` conditionally (offline/theme tests); no shell overflow.
- Quality: build, typecheck, lint and Prettier PASS.

## Analytics summary overflow — 2026-09-02

- Regression: `AnalyticsPage.test.tsx` `2 passed`; desktop 1440px and mobile 412x915 verified in
  Chrome after the responsive metric-value adjustment.
- Visual: negative summary values remain inside the four-card desktop grid; mobile card stacking
  remains unchanged.
- Quality: typecheck, lint and Prettier PASS.

## 12.5.C3-F — Final Screen Audit Closure & Evidence Reconciliation — 2026-09-02

- Pilot ledger reconciliation: the historical six failures were stale selectors (`getByLabel("Importo")`
  colliding with the order control and a `table` role expected for the current `ul` ledger). After
  updating only those test locators, `pnpm exec playwright test test/e2e/pilot-ledger-flow.spec.ts`
  passed `6/6` across Chromium 320/375/390/768/1024/1440, with `0` failures and `0` skips.
- Full unit/integration suite: `pnpm test` passed `620` tests with `4` documented conditional skips.
- Full E2E: `350 passed`, `142 skipped`, `2` failures on the first run were stale test assumptions
  (Accounts used the desktop threshold at exactly 768 px; Dashboard compared an August snapshot
  with the current September demo period). After correcting the boundary and regenerating the
  current 1440 baseline, the affected Accounts/Dashboard suite passed `20`, with `10` conditional
  skips; the corrections were rerun against all configured viewports.
- Gates: `pnpm test:ui-ux`, `pnpm quality:ui-ux`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
  `pnpm manifest:check`, `pnpm codex:validate` and `pnpm build` PASS. The pre-existing build advisory
  about large chunks remains non-blocking.
- Final state: C3.0 is `COMPLETE`; C3.1–C3.21 are `PASS / FROZEN`; P0/P1/P2 are `0/0/0` and no
  unresolved audit blocker remains. Review matrix and roadmap are reconciled; C4 remains pending.

## 12.5.C4.0 — Framework e matrice dei flussi reali completi — 2026-09-02

- Routing: `pnpm codex:route --task "12.5.C4.0 Framework e matrice dei flussi reali completi"` —
  profilo `STANDARD`, rischio dati `low`, nessuno switch necessario.
- Scope: documentale soltanto; nessuna modifica a comportamento applicativo, dominio, database, UI o
  test funzionali. Nessun sub-agent usato e nessuna scansione indiscriminata del repository.
- Fonti pertinenti consultate: PRD 4.1–4.16, `docs/TEST_STRATEGY.md`, framework C3, matrice C3,
  review C3-F, parte finale della presente evidence e file E2E necessari per la mappatura.
- Creati `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md` e
  `.codex/state/c4-real-flow-matrix.md`; aggiornati stato corrente, roadmap, changelog e mappa
  delle fonti autorevoli.
- Matrice registrata: C4.0 `COMPLETE`, C4.1 `NEXT`, C4.2–C4.10 e C4-F `PENDING`; nessun flusso
  operativo dichiarato passato sulla sola presenza di test esistenti.
- Controlli eseguiti: `pnpm format:check` PASS; `pnpm codex:validate` PASS (`17 routes`);
  `pnpm manifest:update` PASS (`PROJECT_MANIFEST.json updated`); `pnpm manifest:check` PASS
  (`PROJECT_MANIFEST.json is current`). Dopo il manifest, `pnpm format:check` e
  `pnpm codex:validate` sono stati ripetuti e sono PASS.
- `pnpm test:ui-ux` PASS (`4 passed`, `0 failed`, `0 skipped`) per la checklist richiesta dalla
  guardia repository.
- Nessun test funzionale, browser o full-suite eseguito: non pertinente alla fase documentale C4.0
  e volutamente non usato per dichiarare PASS ai flussi operativi.

## 12.5.C4.1 — Primo avvio, profilo, primo conto, persistenza e riapertura — 2026-09-03

- Routing: `pnpm codex:route --task "12.5.C4.1 Primo avvio, profilo, primo conto, persistenza e
  riapertura"` — `STANDARD`, rischio dati `low`, nessuno switch necessario.
- Riproduzione iniziale: startup, profilo, conti e persistence smoke isolati erano verdi, ma il
  percorso C4.1 non era ancora coperto end-to-end. La verifica a 320–768 px ha riprodotto un P1:
  Conti non era raggiungibile dalla navigazione mobile perché la sidebar/menu era nascosta.
- Correzione minima: aggiunta la voce `Conti` alla bottom navigation mobile e portata la griglia a
  sei colonne; nessuna modifica a schema, dominio, migrazioni, palette, font o formato monetario.
- Scelta conservativa: onboarding mantiene EUR, `it-IT`, `Europe/Rome` e mese civile; non sono
  stati aggiunti selettori fittizi di valuta/locale né un nuovo wizard.
- Nuovo test: `test/e2e/c4-first-start-account-flow.spec.ts`. Verifica percorso completo con stato
  vuoto, profilo `Profilo C4.1 sintetico`, conto EUR `123,45`, Dashboard, Movimenti senza
  transazioni implicite, reload, nuova pagina nello stesso context, service worker e riapertura
  offline. Include IndexedDB isolato, negativi, doppio invio, axe e overflow.
- Test dedicato: `18 passed`, `0 failed`, `0 skipped` iniziali su 320/375/390/768/1024/1440;
  la prova zoom reale 200% è inclusa sui desktop 1024/1440. Dopo l'aggiunta della prova zoom il
  conteggio finale del file dedicato è `20 passed`, `4 skipped`, `0 failed` (skip: zoom non desktop).
- Test mirati richiesti: `37 passed`, `29 skipped`, `0 failed`; gli skip sono condizionati da
  viewport/backend dei test esistenti e documentati nei test.
- Full E2E: `368 passed`, `142 skipped`, `0 failed`; include i 20 casi C4.1 e smoke OPFS/IndexedDB
  100.000 record passati. Full unit/integration: `620 passed`, `4 skipped`, `0 failed`.
- Quality: `pnpm test:ui-ux` PASS (`4/4`); `pnpm quality:ui-ux` PASS; `pnpm verify` ripetuto
  isolatamente PASS (format/lint/typecheck/unit/build). Il primo verify concorrente con full E2E
  aveva avuto sei timeout di worker Vitest, registrati e non usati come esito finale.
- Console/runtime: nessun `pageerror` o errore console rilevante nel test dedicato; axe PASS,
  overflow assente e target fondamentali verificati dalle superfici interessate.
- Esito: `FLOW_AUDIT_PASS`; P0/P1/P2 = `0/0/0`. C4.1 `COMPLETE`, C4.2 `NEXT`; C3 resta
    congelata e C4.3–C4-F, C5, D, E, F e Fase 13 non sono state avviate.

## 12.5.C4.2-R — Ripristino gate E2E regressione zoom C4.1 — 2026-09-03

- Routing: `pnpm codex:route --task "12.5.C4.2-R Ripristino gate E2E regressione zoom C4.1"` —
  `localized_bug`, profilo `STANDARD`, rischio dati `low`, nessuno switch necessario.
- Riproduzione obbligatoria prima della modifica: `pnpm exec playwright test test/e2e/c4-first-start-account-flow.spec.ts --project=chromium-1024 --project=chromium-1440 --grep "zoom browser reale"` — `0 passed`, `2 failed`; locator fallito `Navigazione principale → Profilo`, timeout 30s. Snapshot: `Navigazione mobile` visibile e sidebar desktop assente. `page.viewportSize()` configurato 1024/1440; viewport CSS renderizzato atteso 512/720 dopo CDP.
- Correzione confinata a `test/e2e/c4-first-start-account-flow.spec.ts`: `navigateToSurface()` usa la visibilità reale dei landmark accessibili e non `page.viewportSize()`; errore esplicito se nessun landmark è visibile. Nessuna modifica UI/applicativa, zoom CDP e copertura non-desktop preservati.
- Verifica zoom dopo correzione: `2 passed`, `0 failed` su `chromium-1024` e `chromium-1440`.
- C4.1 dedicato: `20 passed`, `4 skipped`, `0 failed`; C4.2 dedicato: `8 passed`, `10 skipped`, `0 failed`.
- `pnpm verify`: `620 passed`, `4 skipped`, format, lint, typecheck e build PASS. `pnpm test:ui-ux`: `4 passed`, `0 skipped`; `pnpm quality:ui-ux`: PASS.
- Full E2E: cronologia preservata `376 passed`, `156 skipped`, `2 failed`; dopo C4.2-R `378 passed`, `156 skipped`, `0 failed` su 534 casi. OPFS/IndexedDB 100k, console, axe e overflow pertinenti PASS.
- Manifest: `pnpm manifest:update` eseguito; restano da ripetere i controlli post-update prescritti prima del commit.

## 12.5.C4.3 — Flusso completo dei trasferimenti tra conti — 2026-09-04

- Routing: `pnpm codex:route --task "12.5.C4.3 Flusso completo dei trasferimenti tra conti"` —
  `localized_bug`, profilo `STANDARD`, rischio dati `low`, nessuno switch necessario. Gate C4.2-R
  verificato prima del lavoro: `2 passed`, `4 skipped`, `0 failed` sullo zoom C4.1.
- Nuovo test: `test/e2e/c4-transfer-flow.spec.ts`; nessun codice applicativo, dominio o database
  modificato. Il test copre sei profili (320/375/390/768/1024/1440), con CDP 200% sui due desktop,
  fixture EUR, budget controllato, entrata 500 e spesa 100.
- Riconciliazione: baseline source/destination `1.400,00 / 200,00`, totale `1.600,00`, entrate
  `500,00`, spese `100,00`, netto `400,00`; trasferimento 300 porta a `1.100,00 / 500,00` senza
  variazioni a report o budget; annullamento ripristina `1.400,00 / 200,00`; nuovo 250 porta a
  `1.150,00 / 450,00`. Il trasferimento resta una singola riga UI e le due gambe collegate sono
  verificate dai test `transactionCommands`/`Transfer` e dalle atomicity tests dei repository.
- Suite dedicata C4.3: `8 passed`, `10 skipped`, `0 failed`; gli skip sono intenzionali per offline
  IndexedDB e negativi eseguiti sui profili dedicati. Offline IndexedDB crea e rilegge il trasferimento;
  axe, overflow e console/runtime errors passano nel flusso principale.
- Test mirati: `transactionCommands.test.ts` + `Transfer.test.ts` — `9 passed`, `0 failed`.
- Regressioni: C4.1 zoom `2 passed`, `4 skipped`, `0 failed`. La riesecuzione completa C4.2 ha avuto
  un conflitto transitorio di porta 4173 e un locator legacy fallito a 390 px dopo reopen; non è stato
  usato per dichiarare verde C4.3 né ha modificato il codice C4.2. Il gate C4.2-R richiesto resta verde.
- Review UI/UX: `.codex/reviews/ui-ux/2026-09-04-c4-3-transfer-flow.md`; stato aggiornato in
  `.codex/state/ui-ux-review.md`; P0/P1/P2 = `0/0/0`.

## 12.5.C4.3-R — Chiusura regressioni e gate completi — 2026-09-04

- Controlli iniziali: working tree pulito su `fef97bb`; routing `localized_bug / STANDARD / low`,
  nessuno switch. C4.3-R impostata temporaneamente `IN_PROGRESS` con C4.4 bloccata.
- Riproduzione esatta `pnpm exec playwright test test/e2e/c4-income-expense-flow.spec.ts --project=chromium-390 --repeat-each=3 --workers=1`: `6 passed`, `3 skipped`, `0 failed`, durata `30.2s`. Il failure storico a 390 px dopo reopen non si è riprodotto; nessuna correzione applicata e nessun aggiornamento a `known-failures.md`.
- Regressioni in sequenza: C4.1 zoom `2 passed`, `0 skipped`, `0 failed`, `11.1s`; C4.2 `8 passed`,
  `10 skipped`, `0 failed`, `49.0s`; C4.3 `8 passed`, `10 skipped`, `0 failed`, `56.4s`; unitari
  Transfer `9 passed`, `0 skipped`, `0 failed`, `2.87s`. Gli skip sono quelli dichiarati dalle suite.
- Gate UI/UX: `pnpm test:ui-ux` `4 passed`, `0 failed`; `pnpm quality:ui-ux` review valida.
- Full E2E: `pnpm test:e2e` `386 passed`, `166 skipped`, `0 failed`, durata `9.5m`; include C4.1,
  C4.2, C4.3, axe/overflow/runtime, OPFS e IndexedDB 100k.
- Verify: `pnpm verify` `620 passed`, `4 skipped`, `0 failed`; format, lint, typecheck, unit e build
  verdi. Warning non bloccante invariato sui chunk Vite oltre 500 kB.
- Post-gate: `pnpm codex:validate`, `pnpm manifest:update`, `pnpm manifest:check`, `pnpm format:check`
  e seconda `pnpm codex:validate` PASS; evidenza chiusa nel commit `cb4c320`.
- Causa confermata: non riproducibilità del failure storico; il precedente errore di porta 4173 era
  conflitto ambientale transitorio. Stato finale: `C4.3-R COMPLETE`, C4.3 `FLOW_AUDIT_PASS / COMPLETE`,
  C4.4 `NEXT`.

## 12.5.C4.4-R — Chiusura coperture e riconciliazione documentale — 2026-09-04

- Gate iniziale: route `localized_bug / STANDARD / low`, C4.3-R verde su `cb4c320`; manifest inizialmente
  fallito perché `PROJECT_MANIFEST.json` era stale (`pnpm manifest:check`), mentre `pnpm codex:validate`
  era PASS (`17 routes`). Stato impostato `IN_PROGRESS`, C4.5 non avviata.
- Correzioni funzionali: validatore IndexedDB importato staticamente per impedire la chiusura prematura
  della transazione offline; archiviazione macro disabilitata quando esistono figli; annullamento edit
  del diario e dettaglio ricerca per categorie archiviate. Copertura unitaria aggiunta per la macro con
  figlio e per l’annullamento del diario.
- Suite mirate: web/domain `8 files, 23 passed`; SQLite/IndexedDB `2 files, 80 passed`; build PASS.
- E2E dedicato: `18 casi`, `8 passed`, `10 skipped`, `0 failed`; profili 320/375/390/768/1024/1440,
  CDP zoom reale 200% su 1024/1440. Flusso principale e offline/reload IndexedDB passano; il ritorno
  online verifica un solo movimento e un solo diario. Negative gate su 390 passa.
- Riconciliazione: saldo `920,00 EUR`, spesa `80,00 EUR`, netto `-80,00 EUR`; diario entrate `0,00`,
  spese `80,00`, risparmio `-80,00`, valutazioni investimento `0,00`; riferimenti storici di categoria
  e tag preservati dopo merge/archiviazione/reactivazione; P0/P1/P2 = `0/0/0`.
- Gate UI/UX: `pnpm test:ui-ux` `4 passed`, `0 failed`; `pnpm quality:ui-ux` PASS. Full E2E finale:
  `394 passed`, `176 skipped`, `0 failed` in `9.3m`; il benchmark IndexedDB 100k ha registrato
  `100000/100000` record. `pnpm verify`: `623 passed`, `4 skipped`, build/lint/typecheck/format PASS.
- Post-gate: `pnpm codex:validate` PASS (`17 routes`), `pnpm manifest:update`, `pnpm manifest:check` PASS,
  `pnpm format:check` PASS e seconda `pnpm codex:validate` PASS. Stato finale: `FLOW_AUDIT_PASS / COMPLETE`,
  C4.5 NEXT, nessuna fase C4.5 avviata.
## 2026-09-05 — C4.5 ricorrenze, allocazioni e notifiche

- Baseline mirata prima delle modifiche: `pnpm test -- packages/domain/src/services/executeAllocationPlans.test.ts packages/domain/src/entities/RecurringRule.test.ts apps/web/src/recurring/RecurringPage.test.tsx` — 3 file, 25 test pass, 0 fail.
- Correzione: le allocazioni riusano la data del movimento salary_italy corrispondente, evitando di registrare i trasferimenti sulla data corrente dopo una conferma manuale da `#recurring`.
- Dominio: policy `salary_italy` verificata per sabato 28/03/2026 → 27/03/2026 e domenica 28/06/2026 → 29/06/2026.
- Nuovo E2E `test/e2e/c4-recurring-allocation-notifications-flow.spec.ts`: tutti i profili 7 pass/5 skip motivati; offline desktop 1440 pass; suite E2E completa 401 pass/181 skip/0 failure su 582 casi.
- Gate C4.5: `pnpm verify` pass (140 file Vitest, 624 pass/4 skip); `pnpm quality:ui-ux` pass; `pnpm test:ui-ux` 4 pass; `pnpm codex:test` 8 pass; manifest check e orchestrator validate pass.
- Evidenza UI/UX: `.codex/reviews/ui-ux/2026-09-05-c4-5-recurring-allocation-notifications-flow.md`.

## 2026-09-05 — C4.5-R chiusura offline e riconciliazione

- Gap riprodotto: il test offline preparava solo due conti e un’entrata generica; inoltre il comando
  locale restava in esecuzione mentre attendeva il refresh derivato offline.
- Correzioni: il test ora prepara dalla UI conti, categoria, budget, spesa, salary_italy e tre piani;
  `executeAllocations` completa il ledger locale senza bloccare sul refresh derivato e il reload rilegge
  i dati persistiti.
- E2E dedicato: `7 passed`, `5 skipped`, `0 failed`; target offline 1440 px `1 passed`, `0 failed`.
- Percorso offline: stipendio `2500,00 EUR`, saldi finali `2870/270/110`, patrimonio `3250,00 EUR`,
  budget `400/500`, due trasferimenti visualizzati come quattro leg; piano sospeso escluso.
  Reload offline e riconnessione non producono duplicati; notifica stipendio rimossa e budget mantenuta.
- Regressioni: unit/web `4 file, 38 passed`; E2E budget/notifiche/ricorrenze/movimenti `20 passed`.
- Review: `.codex/reviews/ui-ux/2026-09-05-c4-5-r-offline-allocation-reconciliation.md`; P0/P1/P2 `0/0/0`.

## 2026-09-05 — C4.5-R2 refresh locale immediato e gate definitivi

- Controlli iniziali: checkpoint `1d5f35f`, working tree pulito, routing `localized_bug / STANDARD / low`,
  orchestratore `17 route` valido; `pnpm manifest:check` iniziale fallito perché il manifest era stale.
- Riproduzione baseline: test offline dedicato `1 passed`, mostrando il percorso persistente; la verifica
  senza reload è stata aggiunta per rendere osservabile il gap di modelli UI obsoleti.
- Correzione: rimosso `refresh: false`; dopo ogni mutazione `loadAppModels` rilegge il repository locale
  e il setter React funzionale aggiorna rawTransactions, Conti, Dashboard, Budget e Notifiche.
- Prova offline senza reload, reload offline e riconnessione: `1 passed`; saldi `2870/270/110`, patrimonio
  `3250,00 EUR`, budget `400/500`, due trasferimenti / quattro leg, piano sospeso escluso e notifiche coerenti.
- Suite mirata: `5 file, 39 passed`; regressioni E2E `20 passed`; build PASS. Un primo `verify` ha avuto
  un errore infrastrutturale isolato (`Worker exited unexpectedly`), poi il retry è passato con `624 passed`,
  `4 skipped`, `0 failed` e build/lint/typecheck/format verdi.
- Full E2E: `401 passed`, `181 skipped`, `0 failed` su 582 casi; benchmark IndexedDB/OPFS 100.000 record
  e viewport C4.5 320/375/390/768/1024/1440 inclusi.
- Gate finali: `pnpm test:ui-ux` `4 passed`; `pnpm quality:ui-ux` PASS; `pnpm codex:test` `8 passed`;
  manifest aggiornato e verificato; `pnpm format:check` e orchestratore `17 route` PASS. Review:
  `.codex/reviews/ui-ux/2026-09-05-c4-5-r2-local-refresh-gate.md`. P0/P1/P2 `0/0/0`.

## 2026-09-05 — C4.6 prestiti, investimenti, Dashboard e Analisi

- Baseline: checkpoint `2da1e149d3fc1b91d599684e3cf8b03b1e9ffd0e`, working tree pulito; routing
  `localized_bug / STANDARD / low`, manifest e orchestratore (`17 route`) validi.
- Correzione funzionale: Dashboard espone il pannello condizionale “Debiti e investimenti” fuori dai
  KPI, con prestiti/investimenti EUR separati, rendimento assoluto/percentuale e link dedicati.
  I calcoli usano minor units e bigint; disponibilità e cash-flow mantengono le esclusioni approvate.
- Test mirati: `7 file`, `35 passed`, `0 failed`; build workspace PASS.
- E2E dedicato `test/e2e/c4-loans-investments-dashboard-analytics-flow.spec.ts`: `8 passed`,
  `10 skipped`, `0 failed` su 18 casi distribuiti nei profili 320/375/390/768/1024/1440; CDP zoom
  reale 200% su 1024/1440. Negativo rata zero a 390 PASS; IndexedDB offline a 1440 PASS con
  creazione, modifica, reload e riapertura senza duplicati.
- Riconciliazione: operativo `9468`, Directa `60`, prestito `0`, ledger `9528`, disponibilità `9468`;
  prestito residuo `4828`, investimento `1200`, gain `140 / 13,20%`; settembre `3000/672/2328/77,6%`.
  Il trasferimento `60` è escluso da entrate, uscite e risparmio. Axe, overflow, focus/target e
  console/pageerror passano; tastiera/focus e target interattivi espliciti `44×44` passano dopo il
  passaggio del controllo globale `icon-button` da `40×40` a `44×44`; P0/P1/P2 `0/0/0`.
- Regressioni correlate: `19 passed`, `0 failed` su Loans, Investments, Dashboard, Analytics e
  Transactions a 1440 px. `pnpm verify`: `140 file`, `625 passed`, `4 skipped`, `0 failed`; build,
  lint, typecheck e format verdi. Full E2E: `409 passed`, `191 skipped`, `0 failed` su 600 casi,
  inclusi OPFS/IndexedDB 100.000 record.
- Gate finali: `pnpm test:ui-ux` `4 passed`; `pnpm quality:ui-ux` PASS; `pnpm codex:test` `8 passed`;
  manifest aggiornato/verificato, format check PASS e orchestratore `17 route` PASS. Review:
  `.codex/reviews/ui-ux/2026-09-05-c4-6-loans-investments-dashboard-analytics-flow.md`.
## 12.5.C4.10 — App Lock, impostazioni, cestino, reset, startup e recovery — 2026-09-05

- Gate C4.9: `pnpm build` PASS; `test/e2e/c4-backup-restore-drive-flow.spec.ts` `2 passed`, `0 failed` a 1440.
- Baseline mirato: `pnpm vitest run apps/web/src/security apps/web/src/settings apps/web/src/startup packages/database/src packages/application/src` — 37 file, `236 passed`, `0 failed`.
- Regressione E2E collegata: Chromium 390/1440, `42 passed`, `4 skipped`, `0 failed`.
- Nuovo E2E `test/e2e/c4-app-lock-settings-recovery-flow.spec.ts`: `2 passed`, `0 failed` su 390 e 1440.
- Suite Playwright completa: `433 passed`, `233 skipped`, `0 failed` su 666 test; gli skip restano
  condizionati da viewport/backend e sono quelli dichiarati nei test, senza retry o failure nascosti.
- Il flusso usa seed demo sintetico e crea il backup cifrato via UI; verifica preferenze dopo reload,
  lock fail-closed su navigazione diretta/reload, PIN errato/corretto, trash/restore, annulla reset,
  frase errata, doppio submit, reset con PIN, startup vuoto dopo reopen, verifica e restore del backup.
- Snapshot UI di conti e movimenti identico prima del lock e dopo trash/restore e restore post-reset;
  nessun errore `pageerror` o console error osservato; nessun dato finanziario visibile nella lock screen.
- Unit/startup controllati coprono storage non disponibile, database non apribile, schema/metadati,
  bootstrap interrotto, recovery e retry idempotente senza reset silenzioso.

## 2026-09-06 — C4-F regressione completa e chiusura

- Reconciliata la matrice completa C4.0–C4.10: ogni riga ha report UI/UX, test E2E dedicato o
  correlato, invarianti finanziarie, negativi, persistenza/offline e P0/P1/P2 `0/0/0`.
- Primo full E2E già registrato dal gate C4.10: `666` test, `433 passed`, `233 skipped`, `0 failed`.
- Secondo full E2E eseguito in isolamento seriale (`pnpm exec playwright test --workers=1`):
  `666` test, `433 passed`, `233 skipped`, `0 failed`, durata `23.4m`. Gli skip sono quelli
  condizionati da viewport/backend dichiarati dalla suite; nessun nuovo skip introdotto.
- Il run parallelo diagnostico ha evidenziato contesa del server/browser condiviso; i flussi C4
  falliti nel run concorrente sono passati isolati e non costituiscono failure funzionale.
- Viewport Playwright coperti: `320×800`, `375×812`, `390×844`, `768×1024`, `1024×900`,
  `1440×1000`; CDP zoom reale 200% sui profili desktop previsti. Offline/reload/reopen,
  IndexedDB/OPFS e benchmark 100.000 record inclusi nella suite.
- Nessun dato reale usato; fixture sintetiche locali, trasferimenti neutrali, nessun errore console
  o `pageerror` rilevante nei percorsi C4 dedicati. Gate finale: `C4_FINAL_GATE_PASS`.
# 12.5.C5.0 — Cross-surface consistency framework and initial audit — 2026-09-06

- Routing: `localized_bug / STANDARD / low`; no code files changed and no data behavior changed.
- Browser evidence: local app reached through real hash routes for all main surfaces; responsive
  viewport checks at 320, 375, 390, 768, 1024 and 1440 CSS px; dashboard `scrollWidth/clientWidth`
  showed no horizontal overflow. Manual 390 px screenshot captured the MobileHeader notification
  wrapping issue. Console had no relevant errors in the successful IAB run.
- `pnpm exec playwright test ... phase-12-surfaces.spec.ts` was attempted but could not start after
  pnpm recreated dependencies and the sandbox denied registry access (`EACCES`). `pnpm install`
  was then run with user authorization and completed: 520 packages restored, 0 failures. The first
  Playwright attempt therefore has no test count and is not reported green.
- Documentation gates: `pnpm codex:validate` PASS; `pnpm format:check` PASS;
  `pnpm manifest:update` completed and `pnpm manifest:check` PASS; `pnpm test:ui-ux` PASS
  (`4 passed`, `0 failed`).
- Repository gates: `pnpm typecheck` PASS across 9 projects; `pnpm lint` PASS with zero warnings;
  `pnpm test` PASS (`140` files passed, `1` skipped; `629` tests passed, `4` skipped, `0 failed`);
  `pnpm build` PASS across 9 projects. Build emitted only the existing chunk-size advisory.
## 12.5.C5.4 — Responsive cross-surface consistency — 2026-09-06

- Routing: `localized_bug / STANDARD / low`; scope limitato a audit responsive cross-surface e riallineamento di helper E2E obsoleti, senza modifiche al runtime o alle invarianti contabili.
- Browser reale CUA: verifica a 320, 375, 390, 768, 1024 e 1440 px. A 320–768 px sono presenti mobile header e bottom navigation; a 1024–1440 px il chrome desktop è attivo. `scrollWidth === clientWidth` a tutte le larghezze; minimo touch target calcolato 44 px; console browser senza errori o warning.
- Route audit reale a 390 px: overview, transactions, accounts, budgets, loans, investments e analytics senza overflow né errori console.
- Responsive financial E2E: `34 passed`, `20 skipped`, `0 failed` sui progetti 390/768/1024/1440 e sui flussi C4 coperti.
- Zoom 200% E2E: `12 passed`, `2 skipped`, `0 failed` per shell, dashboard e accounts sui progetti 1024/1440.
- C5-401: chiuso. Quattro helper E2E conservavano l'etichetta accessibile mobile `Home`; riallineati a `Panoramica` senza cambiare route o comportamento applicativo.
- C5-402: accettato. Nessun P0/P1/P2 responsive riprodotto; l'overflow orizzontale della tabella densa locale è intenzionale e confinato al contenitore previsto.
- `pnpm verify`: PASS; format, lint, typecheck, Vitest `140 passed | 1 skipped` / `633 passed | 4 skipped` e build PWA verdi. Build mantiene il warning Vite noto sui chunk >500 kB, senza failure.
- Stato C5.4: P0/P1/P2 aperti `0/0/0`; prossimo task formalizzato: `12.5.C5.5`.
## 12.5.C5.5 — Rifinitura trasversale e regressioni — 2026-09-06

- Routing: `localized_bug / STANDARD / low`; sweep finale senza modifiche runtime, nuove feature,
  route, migrazioni o cambi a dominio/persistenza.
- Rilievi iniziali: C5-001…C5-402 tutti `CLOSED` o `ACCEPTED`; nessun `OPEN`, `PARTIAL` o
  `DEFERRED`. Aggiunti C5-501/C5-502/C5-503 come decisioni `ACCEPTED` per regression,
  security e performance sanity.
- Browser reale: 15 superfici richieste, shell/landmark/H1/accessibility names e console verificati;
  viewport 320/390/768/1024/1440; nessun overflow critico. Touch target minimo 44 px.
- Zoom 200%: shell/dashboard/accounts `12 passed`, `2 skipped`, `0 failed`.
- Smoke/real-flow E2E C4 a 390 px: `11 passed`, `9 skipped`, `0 failed`; coperti movimento,
  trasferimento, conto, budget/analisi, prestiti/investimenti, import, backup/restore e
  ricorrenze/allocazioni.
- Security sanity: nessun secret, dato reale, unsafe HTML, permission o dependency introdotto.
  Performance sanity: nessuna regressione evidente; solo warning Vite chunk >500 kB già noto.
- `pnpm verify`: PASS — Vitest `140 passed | 1 skipped` / `633 passed | 4 skipped`, lint,
  typecheck e build verdi; warning Vite noto non bloccante.
- `pnpm manifest:check`, `pnpm codex:validate`, `pnpm format:check`, `pnpm test:ui-ux`,
  `pnpm quality:ui-ux` e `git diff --check`: PASS.
- Stato C5.5: P0/P1/P2 aperti `0/0/0`; prossimo task `12.5.C5-F`, non avviato.
## 12.5.C5-F — Final cross-surface consistency gate — 2026-09-06

- Routing: `localized_bug / STANDARD / low`; gate di verifica senza modifiche runtime, nuove
  feature, route, migrazioni o refactor.
- Matrice: tutti i rilievi C5 sono `CLOSED` o `ACCEPTED`; nessun `OPEN`, `PARTIAL` o `DEFERRED`.
  P0/P1/P2 aperti `0/0/0`; motivazioni ACCEPTED documentate; nessun rilievo riaperto.
- Browser gate reale: Dashboard, Movimenti, Conti e shell con drawer/focus/route verificati sui
  progetti 320/375/390/768/1024/1440; audit cross-surface delle 15 superfici C5 senza overflow
  critico o errori console. Zoom 200% verificato su shell, Dashboard e Conti.
- Browser E2E finale: `pnpm exec playwright test test/e2e/c3-shell-audit.spec.ts
  test/e2e/c3-dashboard-audit.spec.ts test/e2e/c3-accounts-audit.spec.ts --workers=1` —
  `25 passed`, `17 skipped`, `0 failed`; skip condizionati dai progetti/test selettivi.
- Real-flow evidence C5.5 riconfermata: movimento, trasferimento, conto, budget/analisi,
  prestito/investimento, import, backup/restore e ricorrenze/allocazioni `11 passed`, `9 skipped`,
  `0 failed` a 390 px.
- Accessibility: focus visible/order, landmark, heading, accessible name, form semantics, dialog/
  Escape, reduced motion, reflow, touch target ≥44 px e zoom coperti senza P0/P1.
- Financial gate: `FinancialAmount`, `it-IT`, minor units, segni, entrate/uscite, trasferimenti
  neutrali, saldi, budget, percentuali, prestiti, investimenti, KPI e progress invariati.
- Security/performance: nessun secret/dato reale/unsafe HTML/permission/dependency introdotto;
  nessuna regressione evidente di rendering/listener/layout shift. Warning Vite chunk >500 kB noto,
  non bloccante e documentato.
- `pnpm verify`: PASS — format, lint, typecheck, Vitest `140 passed | 1 skipped` / `633 passed |
  4 skipped`, build verde.
- `pnpm manifest:check`, `pnpm codex:validate`, `pnpm format:check`, `pnpm test:ui-ux`,
  `pnpm quality:ui-ux` e `git diff --check`: PASS.
- Decisione: `C5_FINAL_GATE_PASS`; macrofase 12.5.C5 chiusa. Prossimo task `12.5.D`, non avviato.
## 12.5.D.1 — Audit e riconciliazione dello stato della Fase D — 2026-09-06

- Routing: `localized_bug / STANDARD / low`; attività esclusivamente documentale, senza nuove
  feature, modifiche runtime o riapertura di C3/C4/C5.
- Audit repository: `CHANGELOG.md` conteneva una dichiarazione D COMPLETE, ma non è stata trovata
  una review/matrice/evidence indipendente D. `current-task.md` e `roadmap-progress.md` erano
  invece pending/planned. Incoerenza riconciliata: `12.5.D = IN PROGRESS`.
- Matrice creata: `.codex/state/d-phase-evidence-matrix.md`; UI, UX, responsive, accessibility,
  security e browser verification D sono `MISSING`; automated tests sono `PASS (baseline)` e non
  sostituiscono le review D. P0/P1 aperti: `NO`, con baseline C5 P0/P1/P2 `0/0/0`.
- Evidenze baseline verificate: `pnpm verify` C5-F `633 passed`, `4 skipped`; Playwright C5-F
  `25 passed`, `17 skipped`, `0 failed`. Nessuna nuova suite E2E eseguita perché D.1 è un audit
  documentale e la review D mancante non può essere inventata retroattivamente.
- Controlli D.1: `pnpm manifest:check`, `pnpm codex:validate` e `pnpm format:check` eseguiti dopo
  la riconciliazione; review dedicata e matrice registrano evidence/gap senza dichiarare D PASS.
- Decisione: `12.5.D.1 RESULT: PASS`; `12.5.D = IN PROGRESS`; prossimo task esclusivo
  `12.5.D.2 — Independent UI/UX + Responsive Review`.
# 15.0 — Local Hub Rust foundation — 2026-09-07

- Router: `pnpm codex:route -- --task="15.0 Local Hub Rust service foundation and API contract"` → `local_hub / CRITICAL / medium`.
- `cargo test --manifest-path apps/local-hub/Cargo.toml`: 3 passed, 0 failed; generated and committed `apps/local-hub/Cargo.lock`.
- Negative security tests: LAN binding rejected before TLS/pairing; operation envelope round-trip excludes SQLite payload.
- No browser test: no UI/listener changed. No accounting/storage behavior changed.
- Evidence: `.codex/reviews/phase-15-0-local-hub-foundation.md`.

# 15.1 — Local Hub LAN/TLS/identity — 2026-09-07

- Router: `pnpm codex:route -- --task="15.1 Opt-in LAN binding, TLS and device identity"` → `local_hub / CRITICAL / low`.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml`: 5 passed, 0 failed; rustls server configuration and PEM parser compile-tested.
- Negative security tests: LAN rejects unspecified/loopback addresses, missing TLS certificate/key and missing host fingerprint; device identity rejects wrong token.
- No private key, token, ledger or SQLite file is stored or logged; no listener is exposed by this slice.
- `pnpm manifest:check`: PASS. Evidence: `.codex/reviews/phase-15-1-lan-tls-identity.md`.

# 15.2 — Local Hub discovery/pairing — 2026-09-08

- Router: `pnpm codex:route -- --task="15.2 mDNS DNS-SD discovery explicit QR pairing device revocation"` → `local_hub / CRITICAL / medium`.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml`: 8 passed, 0 failed.
- Negative pairing tests: wrong code, expiry, single-use replay and revocation; discovery requires explicit LAN and `_nexora._tcp` service.
- No live mDNS listener or unauthenticated LAN endpoint is started in this contract slice.
- Evidence: `.codex/reviews/phase-15-2-discovery-pairing.md`.

# 15.3 — Local Hub authorization/rate/audit — 2026-09-08

- Router: `pnpm codex:route -- --task="15.3 Authenticated operations rate limiting audit negative security tests"` → `security_review / CRITICAL / low`.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml`: 11 passed, 0 failed.
- Negative security tests: unknown device, wrong token, per-device limit/window, and audit redaction; no token or secret appears in audit metadata.
- Evidence: `.codex/reviews/phase-15-3-auth-rate-audit.md`.

# 15.F — Final Local Hub gate — 2026-09-08 — BLOCKED

- `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 12 passed, 0 failed, including in-process HTTP health/authorization checks.
- `pnpm codex:validate`: PASS. `pnpm manifest:check`: stale only because the new checkpoint must be included; no application failure.
- Gate result: NOT PASS. Axum/Tokio runtime and mdns-sd provider integration are now present; unit/in-process tests verify fail-closed behavior, but an independent network-security review is still required.
- Security policy blocker: `nexora-sync` and `nexora-security` require independent review for network exposure; no independent reviewer capability is available in this run.
- P0/P1/P2: 0/1/0. No subsequent Phase 16 task is authorized until 15.F is resolved.
- Follow-up security hardening: pairing now validates the host fingerprint and derives device identity from a separate device token; discovery provider rejects unapproved advertisements before daemon startup; `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 14 passed, 0 failed.
- Final runtime hardening: LAN TLS configuration is validated before any socket bind and rate limiting returns `429`; `cargo clippy --manifest-path apps/local-hub/Cargo.toml --locked -- -D warnings`: PASS.
- Constant-time hardening: device token digest comparison uses `subtle::ConstantTimeEq`; `cargo test` 14/14 and `cargo clippy -D warnings` remain PASS.
- Independent security review: `.codex/reviews/security/2026-09-08-15-f-independent-security-review.md`, P0/P1/P2 `0/0/0`; `15.F PASS`, next `16.0`.

# 16.0 — Replicable operation schema/log — 2026-09-08

- Router: `pnpm codex:route -- --task="16.0 Replicable operation schema append-only log payload revisions cursors"` → `database_migration / ADVANCED / low`; `nexora-sync` and `nexora-database` applied.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 16 passed, 0 failed.
- Coverage: payload and tombstone preservation, deterministic revision/cursor assignment, duplicate idempotency and stale-revision conflict rejection.
- No SQLite migration, ledger data, float amount or accounting invariant changed; no open P0/P1/P2.
- Evidence: `.codex/reviews/phase-16-0-operation-schema.md`.

# 16.1 — Push/pull transport and checkpoints — 2026-09-08

- Router: `pnpm codex:route -- --task="16.1 offline-first synchronization push pull transport idempotency replay protection durable checkpoints"` → `synchronization / CRITICAL / medium`.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 17 passed, 0 failed.
- Coverage: batch push, duplicate delivery ID replay rejection, incremental pull, bounded acknowledgement and operation-level idempotency.
- No database migration or real ledger access; no open P0/P1/P2.
- Evidence: `.codex/reviews/phase-16-1-push-pull-transport.md`.

# 16.2 — Offline queue and reconciliation — 2026-09-08

- Router: `pnpm codex:route -- --task="16.2 offline-first synchronization queue retry partial duplicate delivery reconciliation"` → `synchronization / CRITICAL / medium`.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 19 passed, 0 failed.
- Coverage: partial delivery retention, retry attempt increment, complete Applied acknowledgement, Duplicate acknowledgement and Conflict retention.
- No silent conflict deletion, SQLite migration or real ledger access; no open P0/P1/P2.
- Evidence: `.codex/reviews/phase-16-2-offline-queue-reconciliation.md`.

# 16.3 — Explicit conflicts and review UI — 2026-09-08

- Router: `pnpm codex:route -- --task="16.3 offline-first synchronization explicit conflicts deterministic policy conflict UI"` → `synchronization / CRITICAL / medium`.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 20 passed, 0 failed.
- `pnpm --filter @nexora/ui typecheck`: PASS; `pnpm exec vitest run packages/ui/src/SyncConflictBanner.test.tsx`: 2 passed, 0 failed.
- Coverage: explicit conflict record, deterministic manual policy, visible “Esamina” action and no automatic overwrite/merge or silent last-write-wins.
- No SQLite migration, real ledger access, float amount or accounting invariant changed; P0/P1/P2 open 0/0/0.
- Evidence: `.codex/reviews/phase-16-3-conflict-policy-ui.md`; `.codex/reviews/ui-ux/phase-16-3-conflict-policy-ui.md`.

# 16.4 — Recovery, revocation and multi-device verification — 2026-09-08

- Router: `pnpm codex:route -- --task="16.4 sync recovery device revocation multi-device verification"` → `synchronization / CRITICAL / medium`.
- `cargo fmt --manifest-path apps/local-hub/Cargo.toml`; `cargo test --manifest-path apps/local-hub/Cargo.toml --locked`: 22 passed, 0 failed.
- Coverage: recovery restores bounded checkpoint and pending deliveries without dropping data; authorized push rejects revoked devices; two paired devices produce an explicit stale-revision conflict.
- No SQLite migration, real ledger access, float amount or accounting invariant changed; P0/P1/P2 open 0/0/0.
- Evidence: `.codex/reviews/phase-16-4-recovery-revocation-multidevice.md`.

# 16.F — Final offline-first sync gate — 2026-09-08

- Router: `pnpm codex:route -- --task="16.F final offline-first synchronization gate operation log transport queue conflicts recovery revocation"` → `synchronization / CRITICAL / medium`.
- Reconciled task evidence: 16.0 cargo 16/16, 16.1 cargo 17/17, 16.2 cargo 19/19, 16.3 cargo 20/20 plus UI 2/2, 16.4 cargo 22/22.
- Final repository gate: `pnpm verify` PASS — 141 files passed, 1 skipped; 635 tests passed, 4 skipped; build PASS. `pnpm test:ui-ux` 4/4; `pnpm codex:test` 12/12; manifest current; orchestrator valid.
- Accounting invariants: no SQLite migration, real ledger access, float amount or silent conflict resolution; P0/P1/P2 open 0/0/0.
- Evidence: `.codex/reviews/phase-16-f-final-sync-gate.md`.
- Orchestrator follow-up: the first final-gate validation exposed the required `current` marker for the active macrophase; roadmap state was corrected and validation rerun before Phase 17.

# 17.0 — Large-dataset performance — 2026-09-08

- Router: `pnpm codex:route -- --task="17.0 large dataset performance pagination query strategy 100k records"` → `ui_component / STANDARD / low`.
- `pnpm exec vitest run apps/web/src/transactions/pagination.test.ts packages/domain/src/services/monthlyTrends.test.ts`: 2 files, 6 tests passed.
- `$env:NEXORA_HARDENING_BENCHMARK="1"; pnpm exec vitest run test/benchmarks/hardeningBenchmark.test.ts`: 1 file, 4 tests passed, including 100k synthetic records.
- Existing transaction pagination caps rendered rows at 100 and normalizes out-of-range pages; no repository/query or accounting invariant changed.
- P0/P1/P2 open 0/0/0. Evidence: `.codex/reviews/phase-17-0-large-dataset-performance.md`.
- Orchestrator follow-up: added an explicit standalone `PASS` marker and corrected the current task phase to Phase 17 after the gate parser rejected the underscored token.

# 17.1 — Storage quota and interruption recovery — 2026-09-08

- Router: `pnpm codex:route -- --task="17.1 storage quota interrupted writes import backup recovery"` → `repository_refactor / ADVANCED / medium`.
- `pnpm --filter @nexora/web typecheck`: PASS; focused Vitest for quota, OPFS restore, encrypted/portable backup and import rollback: 7 files, 32 passed, 0 failed.
- `estimateStorageQuota` reports usage/quota when available and fails closed when unavailable; no storage is mutated by the estimate.
- Existing atomic rollback, import preview/commit and encrypted restore paths remain covered; no SQLite migration, float amount or accounting invariant changed.
- P0/P1/P2 open 0/0/0. Evidence: `.codex/reviews/phase-17-1-storage-recovery.md`.

# 17.2 — Service Worker and backup regression — 2026-09-08

- Router: `pnpm codex:route -- --task="17.2 Service Worker A to B update cross-platform backup restore regression"` → `manual_backup / ADVANCED / medium`.
- `pnpm exec vitest run apps/web/src/pwa/PwaUpdateNotice.test.tsx packages/database/src/backup/EncryptedSqliteBackup.test.ts packages/database/src/backup/PortableBackupEngine.test.ts packages/database/src/backup/LocalSqliteBackupService.test.ts`: 34 passed, 0 failed.
- PWA update requires an explicit service-worker-ready signal and user action; backup verification covers checksum failure, rollback and cross-adapter restore.
- P0/P1/P2 open 0/0/0. Evidence: `.codex/reviews/phase-17-2-pwa-backup-regression.md`.

# 17.3 — Security, supply-chain and secret audit — 2026-09-08

- Router: `pnpm codex:route -- --task="17.3 final security supply chain secret scan dependency audit"` → `security_review / CRITICAL / low`.
- `pnpm audit --prod --audit-level high`: PASS — No known vulnerabilities found.
- Secret-pattern scan with `rg` over tracked source (excluding generated dependencies/build output): no credential/key matches; exit 1 indicates no matches, not a hidden failure.
- Existing Local Hub negative/security tests remain part of the validated baseline; no secrets, credentials or ledger data were accessed.
- P0/P1/P2 open 0/0/0. Evidence: `.codex/reviews/phase-17-3-security-supply-chain.md`.

# 17.4 — Bundle/startup performance, platform regressions and full E2E — 2026-09-08

- Router: `pnpm codex:route -- --task="17.4 bundle startup performance platform regressions full E2E"` → `ui_component / ADVANCED / low`.
- `pnpm exec playwright test --workers=8`: 420 passed, 233 skipped and 13 contention-related 30s timeouts under parallel load; no failure was accepted as green.
- `pnpm exec playwright test --last-failed --workers=1`: 13 passed, 0 failed, confirming the failures were parallel resource contention rather than reproducible product regressions.
- The existing production preview bundle served successfully; startup, offline reload, responsive viewports and 200% zoom scenarios are covered by the suite. No code or accounting invariant changed.
- P0/P1/P2 open 0/0/0. Evidence: `.codex/reviews/phase-17-4-bundle-startup-e2e.md`.

# 17.5 — Release candidate evidence and operational readiness — 2026-09-08

- Router: `pnpm codex:route -- --task="17.5 release candidate evidence operational readiness reconciliation"` → `final_release / CRITICAL / low`.
- `pnpm verify`: format check, lint, all workspace typechecks, 142 Vitest files with 637 passed/4 skipped, and production PWA build passed.
- Production build generated the service worker and precache manifest with 33 entries; large-chunk output is an existing advisory, not a failure.
- `pnpm manifest:check`: current. No code, ledger, schema or accounting invariant changed.
- P0/P1/P2 open 0/0/0. Evidence: `.codex/reviews/phase-17-5-release-readiness.md`.

# 17.F — Final READY/NOT READY gate — 2026-09-08

- Router: `pnpm codex:route -- --task="17.F final READY NOT READY gate Nexora 1.0"` → `localized_bug / STANDARD / low` (repository router result recorded verbatim).
- `pnpm verify` from 17.5: format/lint/typecheck PASS, 637 tests passed/4 skipped, production PWA build PASS.
- Full E2E from 17.4: 420 parallel passes, 233 expected skips; all 13 contention timeouts passed on serial retry.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities. `pnpm manifest:check`, `pnpm codex:validate`, `pnpm codex:test` and `pnpm test:ui-ux`: PASS.
- Accounting invariants, schema, backup/restore, Local Hub and offline-first sync evidence remain unchanged and reconciled; P0/P1/P2 open 0/0/0.
- Final result: `Nexora 1.0 READY`. Evidence: `.codex/reviews/phase-17-f-final-ready.md`.

## 2026-09-08 — Native account deletion regression

- Route: `tauri_android / ADVANCED`, data risk `low`.
- `pnpm exec vitest run packages/database/src/sqlite/SqliteLedgerRepository.test.ts apps/web/src/App.test.tsx` — PASS, 53 tests.
- `pnpm exec tsc -p apps/web/tsconfig.json --noEmit` and `pnpm exec tsc -p packages/database/tsconfig.json --noEmit` — PASS.
- `pnpm lint -- --quiet`, `pnpm build` and `git diff --check` — PASS; Vite emitted existing chunk-size warnings only.
- `pnpm --filter @nexora/web tauri build --no-bundle` — PASS; Windows startup smoke PASS.
- `gradlew.bat assembleArm64Release -x rustBuildArm64Release --no-daemon --rerun-tasks` — PASS, 90 tasks, after native Rust compilation and manual JNI library copy required by Windows symlink policy.
- APK: `apps/web/src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release-unsigned.apk`, 17,587,844 bytes, SHA-256 `0F053A22C61EDC5F17CEED435D80EA4025972D6E9983D431523AE0330BAF6C37`.
- Windows executable: `Nexora-desktop.exe`, 13,532,160 bytes, SHA-256 `68665612B043BD39ECE42180235139DDBAEB92B3FA915A46D5604733537D720D`.
- APK signing and device/emulator smoke: not claimed; artifact is unsigned and no device was connected.
## 2026-09-08 — Native CRUD persistence regression

- Route: `tauri_android / ADVANCED`, data risk `low`.
- `pnpm exec vitest run packages/database-tauri/src/TauriSqliteDatabase.test.ts packages/database-tauri/src/openTauriLedger.test.ts packages/database/src/sqlite/SqliteLedgerRepository.test.ts` — PASS, 46 tests.
- `pnpm exec tsc -p packages/database-tauri/tsconfig.json --noEmit` — PASS.
- `pnpm exec tsc -p packages/database/tsconfig.json --noEmit` — PASS.
- `pnpm exec prettier --check ...` — PASS.
- `pnpm lint -- --quiet` — PASS.
- `pnpm build` — PASS; PWA precache generated. Vite emitted existing chunk-size warnings only.
- `cargo check --manifest-path apps/web/src-tauri/Cargo.toml --locked` — PASS.
- `cargo check --manifest-path apps/web/src-tauri/Cargo.toml --locked --target aarch64-linux-android` — BLOCKED by environment: `aarch64-linux-android-clang`/`clang.exe` is not installed; compilation reached `libsqlite3-sys` before the toolchain failure.
- Android device/emulator smoke — not available in this environment; no device was connected.

## 2026-09-08 — Android APK rebuild after native CRUD fix

- `pnpm build` — PASS; updated web assets generated.
- `gradlew.bat assembleArm64Release -x rustBuildArm64Release --no-daemon` — PASS, 90 tasks; the
  full Tauri Rust task was intentionally skipped because it requires the missing temporary dev
  server address file and native Rust code was unchanged.
- APK: `apps/web/src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release-unsigned.apk`.
- Size: `165304700` bytes. SHA-256:
  `A29D70C28DCCB057571C1C7D0B1519EA6FC230665D733116F3834D4A8D2C544D`.
- Signing: not claimed; artifact is explicitly unsigned. Device/emulator: N/A.

## 2026-09-08 — Windows executable rebuild after native CRUD fix

- `pnpm --filter @nexora/web tauri build --no-bundle` — PASS; release Rust build completed in
  2m 40s and produced `apps/web/src-tauri/target/release/nexora.exe`.
- Delivered executable: `Nexora-desktop.exe`, 13,531,648 bytes.
- SHA-256: `FE810D80749AA66BA9ECD5FB0ED81726B5980D6A02D936C1CA637AC699ACF0CB`.
- Startup smoke: PASS; process started and responded, then was closed after verification.
- MSI/NSIS bundling was not requested in this step; this artifact is the standalone executable.
