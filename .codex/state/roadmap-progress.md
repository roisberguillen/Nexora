# Roadmap progress

Authoritative roadmap: `docs/ROADMAP_UI_ARCHITECTURE.md`.

| Phase | Verified state | Evidence location |
|---|---|---|
| 0–6 | complete | roadmap evidence sections |
| 7 | complete | roadmap Phase 7 evidence; native schema 13 verification |
| 8 | complete | roadmap Phase 8 evidence and phase audit |
| 9 | complete | roadmap Phase 9 evidence and shared engine tests |
| 10 | complete | roadmap Phase 10 evidence; manual file workflow and browser tests |
| 11 | complete | configured tests plus authorized live consent, upload, reread, read-only verification, restore and ledger reopen |
| 12 | complete — 2026-08-14 | all roadmap-assigned financial/UI surfaces audited against code, documentation and CI on `4ab136e`; no Phase 12 P0/P1 remains |
| 12.1 | complete | hierarchical financial categories, published and verified |
| 12.2 | complete | expense behavior classification and recurring-model alignment, including final form corrections |
| 12.3 | complete | advanced calendar, additive migration v17, SQLite/IndexedDB parity, portable backup compatibility and responsive UI; merged via PR #3 with GitHub Actions green on `main` (`0ea79e8`) |
| 12.4 | complete | hierarchical budget CRUD, macro/subcategory scope, split-safe progress, responsive UI and adapter parity; merged via PR #4 with GitHub Actions green on `main` (`e9b4d3f`) |
| 12.4.1 | complete | recurring effective-dated monthly budget revisions, migration v19, historical month navigation and GitHub `verify` green; merged via PR #6 (`5efc529`) |
| 12.5 | complete | allocation plan CRUD, confirmed idempotent execution, backup/reset compatibility and responsive UI; merged via PR #7 with GitHub `verify` green on `main` (`3edeabb`) |
| 12.A–E | complete | CI/manifest repair, investment repository integrity, removal of unsafe investment CSV import, Europe/Rome civil-date defaults and final automated coverage; GitHub CI green on `main` (`4ab136e`) |
| 12.5.C2.1 | complete | evidence and state aligned; banking shell foundation closed |
| 12.5.C2.2 | complete / functionally covered | existing verified behavior covers the slice; no new completion claim added |
| 12.5.C2.3 | complete | closure demonstrated by subsequent C2.7/C2.8 evidence for list, detail, form, responsive and accessibility |
| 12.5.C2.4 | complete | evidence recorded in the phase review and test evidence |
| 12.5.C2.5 | complete | evidence recorded in the phase review and test evidence |
| 12.5.C2.6-R | complete | transfer editing blocker resolved and verified |
| 12.5.C2.7 | complete | Mobile Banking UX Movimenti closed with `UI_REVIEW_PASS`, all required gates green and zoom 200% verified |
| 12.5.C2.8 | complete | UI hardening, accessibilità, stati, double-submit e responsive verification |
| 12.5.C2.9 | complete | Final Transactions Gate PASS; Movimenti frozen after the C2 sequence |
| 12.5.C2 | complete | final Transactions Gate PASS; Movimenti frozen |
| 12.5.C3.0 | complete | full Mobile/Desktop screen audit framework prepared |
| 12.5.C3.1 | complete | App Shell + Navigation `SCREEN_AUDIT_PASS`; focus management and responsive evidence closed |
| 12.5.C3.2 | complete | Global Search `SCREEN_AUDIT_PASS`; mobile/desktop, keyboard, zoom and responsive evidence closed |
| 12.5.C3.3 | complete | Dashboard/Home `SCREEN_AUDIT_PASS`; R2 monthly overview plus R3 financial-correctness hardening, overlap-safe budget summary, responsive states, accessibility and zoom evidence closed |
| 12.5.C3.4 | complete | Accounts / Conti `SCREEN_AUDIT_PASS`; list/editor, CRUD, archive/delete rules, responsive and accessibility evidence closed |
| 12.5.C3.5 | complete | Transactions regression `SCREEN_AUDIT_PASS`; Movimenti frozen after six-viewport regression and gate closure |
| 12.5.C3.6 | complete | Budget `SCREEN_AUDIT_PASS`; mobile/desktop, period, thresholds, hierarchy and financial propagation verified; Budget frozen |
| 12.5.C3.7 | complete | Recurring + Allocations `SCREEN_AUDIT_PASS`; responsive, confirmation, idempotency and transfer invariants verified; surface frozen |
| 12.5.C3.8 | complete | Prestiti `SCREEN_AUDIT_PASS`; responsive, detail, CRUD, precisione monetaria e delete protetto verificati; surface frozen |
| 12.5.C3.9 | complete | Investimenti `SCREEN_AUDIT_PASS`; responsive, CRUD, precisione monetaria, valute e Dashboard integration verified; surface frozen |
| 12.5.C3.10 | complete | Analytics `SCREEN_AUDIT_PASS / FROZEN`; redesign, responsive, accessibility and manifest evidence closed |
| 12.5.C3.11 | complete | Financial Journal `SCREEN_AUDIT_PASS / FROZEN`; CRUD, responsive, keyboard, privacy and financial isolation verified |
| 12.5.C3.12 | complete | Categories `SCREEN_AUDIT_PASS / FROZEN`; responsive, CRUD, hierarchy, integrity and accessibility evidence closed |
| 12.5.C3.13 | complete | Tags `SCREEN_AUDIT_PASS / FROZEN`; responsive, CRUD, relations, duplicate protection, accessibility and Transactions integration verified |
| 12.5.C3.14 | complete | Import `SCREEN_AUDIT_PASS / FROZEN`; responsive, preview, mapping, deduplica, atomicità, undo e sicurezza verificati |
| 12.5.C3.15 | complete | Export `SCREEN_AUDIT_PASS / FROZEN`; scope, formati, precisione, relazioni, privacy, sicurezza e responsive verificati |
| 12.5.C3.16 | complete | Backup + Restore `SCREEN_AUDIT_PASS / FROZEN`; cifratura, round-trip, validazione, atomicità, recovery e responsive verificati |
| 12.5.C3.17 | complete | Notifications `SCREEN_AUDIT_PASS / FROZEN`; derivation, deduplica, read state, deep-link e responsive verificati |
| 12.5.C3.18 | complete | Profile `SCREEN_AUDIT_PASS / FROZEN`; local display name, responsive form, persistence and privacy links verified |
| 12.5.C3.19 | complete | Privacy/Sicurezza + App Lock `SCREEN_AUDIT_PASS / FROZEN`; fail-closed lock, reauthentication, recovery and isolation verified |
| 12.5.C3.20 | complete | Settings + Trash + Reset `SCREEN_AUDIT_PASS / FROZEN`; preferences, lifecycle, reset safety and integrity verified |
| 12.5.C3.21 | complete | Startup + Recovery `SCREEN_AUDIT_PASS / FROZEN`; loading, safe bootstrap, explicit archive recovery and responsive states verified |
| 12.5.C3-F | complete — 2026-09-02 | `C3_FINAL_GATE_PASS`; pilot ledger reconciled, full unit/E2E and repository quality gates verified; C3.0–C3.21 matrix frozen |
| 12.5.C4.0 | complete — 2026-09-02 | C4 real complete-flow framework and authoritative matrix registered; C4.1 next |
| 12.5.C4.1 | complete — 2026-09-03 | `FLOW_AUDIT_PASS`; first startup, profile, first account, persistence, reopen and offline verified on OPFS/IndexedDB |
| 12.5.C4.2 | complete — 2026-09-03 | `FLOW_AUDIT_PASS`; complete income/expense cycle, reconciliation, persistence, offline and repaired C4.1 zoom gate verified |
| 12.5.C4.2-R | complete — 2026-09-03 | E2E zoom navigation regression repaired in the test harness; full E2E green |
| 12.5.C4.3 | complete — 2026-09-04 | `FLOW_AUDIT_PASS`; trasferimento completo, annullamento atomico, persistenza, offline e report neutrali verificati |
| 12.5.C4.3-R | complete — 2026-09-04 | `FLOW_AUDIT_PASS`; failure C4.2 a 390 px non riprodotto; regressioni e gate completi verdi |
| 12.5.C4.4 | complete — 2026-09-04 | `FLOW_AUDIT_PASS`; categorie, tag, ricerca globale, diario, merge, persistenza e offline verificati |
| 12.5.C4.4-R | complete — 2026-09-04 | chiusura coperture, IndexedDB offline/reload, riconciliazione documentale e gate completi |
| 12.5.C4.5 | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; ricorrenza salary_italy, stipendio, allocazioni idempotenti, budget, notifiche, reload/offline e gate completi |
| 12.5.C4.5-R | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; ciclo stipendio/allocazioni completo offline su IndexedDB, reload/rete senza duplicati, riconciliazione documentale e gate completi |
| 12.5.C4.5-R2 | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; refresh locale immediato verificato prima del reload, offline/reload/rete senza duplicati e gate completi |
| 12.5.C4.6 | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; prestiti, investimenti, Dashboard, Analisi, riconciliazione, sei viewport, zoom 200%, negativi e IndexedDB offline verificati |
| 12.5.C4.7 | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; Money Manager XLSX reale, piano/mapping, commit atomico, deduplica, undo, reload/reopen, IndexedDB offline, OPFS/PWA e zoom CDP verificati |
| 12.5.C4.8 | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; estratto conto, mapping, undo/export, deduplica, reload/reopen e IndexedDB offline verificati |
| 12.5.C4.9 | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; backup manuale, verifica, restore A → B → A, rollback, IndexedDB offline e Drive opzionale verificati |
| 12.5.C4.10 | complete — 2026-09-05 | `FLOW_AUDIT_PASS`; App Lock, preferenze, cestino/restore, reset confermato, startup e recovery verificati |
| C4 | complete — 2026-09-06 | `C4_FINAL_GATE_PASS`; C4.0–C4.10 e regressione finale chiuse |
| C5 | complete — 2026-09-06 | `C5_FINAL_GATE_PASS`; C5.1–C5.5 e gate finale chiusi; 0 P0, 0 P1, 0 P2 aperti; 12.5.D next |
| D | complete — 2026-09-07 | `12.5.D COMPLETE / PASS`; D.1–D.4 e D.F chiuse; prossimo 12.5.E.1 |
| E | complete — 2026-09-07 | `12.5.E COMPLETE / PASS`; E.1–E.3 ed E.F riconciliate |
| F | complete — 2026-09-07 | `12.5.F COMPLETE / PASS`; release freeze chiuso; prossimo 13.0 |
| 12.5.C4 | complete — 2026-09-06 | `C4_FINAL_GATE_PASS`; real complete flows e regressione finale chiusi |
| 12.5.C5 | complete — 2026-09-06 | `C5_FINAL_GATE_PASS`; cross-surface consistency chiusa; prossimo task 12.5.D |
| 12.5.D | complete — 2026-09-07 | `12.5.D COMPLETE / PASS`; D.1/D.2/D.3/D.4/D.F chiuse; prossimo 12.5.E.1 |
| 12.5.E | complete — 2026-09-07 | `12.5.E COMPLETE / PASS`; E.1–E.3 ed E.F riconciliate; prossimo 12.5.F |
| 12.5.E.1 | complete — 2026-09-07 | Final Quality Gate PASS; verify, full E2E, manifest e state green; prossimo 12.5.E.2 |
| 12.5.E.2 | complete — 2026-09-07 | Real-Flow Full Regression Gate PASS; 83 targeted + 433 full E2E passed; prossimo 12.5.E.3 |
| 12.5.E.3 | complete — 2026-09-07 | Data Integrity & Recovery Final Gate PASS; round-trip, checksum, rollback, restore e adapter parity verdi; prossimo 12.5.E.F |
| 12.5.E.F | complete — 2026-09-07 | Final Phase E Gate PASS; E.1–E.3, verify, manifest e state riconciliati; prossimo 12.5.F |
| 12.5.F | complete — 2026-09-07 | Release Freeze PASS; baseline 12.5 congelata; prossimo 13.0 |
| 13 | complete — 2026-09-07 | `13.F COMPLETE / PASS`; desktop evidence reconciled; prossimo 14.0 |
| 13.0 | complete — 2026-09-07 | Tauri build, native adapter, cargo locked check e desktop startup smoke PASS; prossimo 13.1 |
| 13.1 | complete — 2026-09-07 | Desktop shell/native persistence parity PASS; 76 tests, cargo locked check, build e startup smoke; prossimo 13.2 |
| 13.2 | complete — 2026-09-07 | Desktop packaging readiness PASS; MSI/NSIS, cargo locked check, verify e startup smoke; prossimo 13.3 |
| 13.3 | complete — 2026-09-07 | macOS x64/arm64 matrix and full verify PASS in CI 34156198571; Linux baselines/root overflow hardened; 0/0/0; next 13.4 |
| 13.4 | complete — 2026-09-07 | Native backup/restore tests 68/68, locked check, Windows MSI/NSIS build and full verify 633 passed/4 skipped; 0/0/0; prossimo 13.F |
| 13.F | complete — 2026-09-07 | Windows/macOS, native persistence, packaging, backup/restore and regression evidence reconciled; 0/0/0; prossimo 14.0 |
| 14.0 | complete — 2026-09-07 | Tauri Android initialized; Rust aarch64 target compiled; Gradle arm64 debug APK packaging PASS; full Tauri symlink command limitation recorded; 0/0/0; prossimo 14.1 |
| 14.1 | complete — 2026-09-07 | Shared Tauri adapter, migration catalog and repository parity: 11 files/76 tests and typechecks PASS; 0/0/0; prossimo 14.2 |
| 14.2 | complete — 2026-09-07 | Tauri lifecycle delegation and shared startup/persistence/recovery: 18 files/72 tests and typechecks PASS; 0/0/0; prossimo 14.3 |
| 14.3 | complete — 2026-09-07 | Import/Backup picker and responsive browser verification: 45 passed/9 skipped on six viewports; no extra permissions; 0/0/0; prossimo 14.4 |
| 14.4 | complete — 2026-09-07 | App Lock, encrypted backup/restore, recovery and Android permission boundary: 9 files/43 tests PASS; Keystore/biometric not required by current secret contract; 0/0/0; prossimo 14.5 |
| 14.5 | complete — 2026-09-07 | Arm64 Rust release, unsigned APK and AAB Gradle packaging PASS; ADB device verification N/A (no device/emulator); 0/0/0; prossimo 14.F |
| 14.F | complete — 2026-09-07 | Phase 14 Android evidence reconciled: init, shared SQLite, lifecycle, responsive picker, security, arm64 APK/AAB and full verify PASS; device/signing N/A explicitly recorded; 0/0/0; prossimo 15.0 |
| 15.0 | complete — 2026-09-07 | Rust Local Hub contract foundation; loopback default, LAN fail-closed guard and incremental operation metadata; cargo test 3/3; 0/0/0; prossimo 15.1 |
| 15.1 | complete — 2026-09-07 | LAN opt-in fail-closed config, specific address/TLS/fingerprint gates and SHA-256 device token digest; cargo test 5/5; 0/0/0; prossimo 15.2 |
| 15.2 | complete — 2026-09-08 | Explicit `_nexora._tcp` advertisement contract, single-use expiring QR grant and device revocation; cargo test 8/8; 0/0/0; prossimo 15.3 |
| 15.3 | complete — 2026-09-08 | Paired-device authorization, per-device rate limiting, redacted audit metadata and negative security tests; cargo test 11/11; 0/0/0; prossimo 15.F |
| 15.F | complete — 2026-09-08 | Final Local Hub gate PASS; runtime/TLS/mdns-sd/pairing/auth controls and independent security review reconciled; 0/0/0; prossimo 16.0 |
| 16 | current | Phase 16 sync in corso; 16.0 complete, 16.1 next |
| 16.0 | complete — 2026-09-08 | Rust replicable operation schema with payload/tombstone, append-only log, deterministic revision/cursor and stale-write rejection; cargo test 16/16; 0/0/0; prossimo 16.1 |
| 16.1 | complete — 2026-09-08 | Incremental push/pull, delivery replay rejection, cursor checkpoint bounds and operation idempotency; cargo test 17/17; 0/0/0; prossimo 16.2 |
| 16.2 | complete — 2026-09-08 | Offline queue, retry attempt tracking, partial/duplicate delivery and explicit reconciliation; cargo test 19/19; 0/0/0; prossimo 16.3 |
| 16.3 | planned | Explicit conflict detection, deterministic policy and conflict UI |
| 16.4 | planned | Recovery, device revocation and multi-device verification |
| 16.F | planned | Final offline-first sync gate |
| 17.0 | planned | Large-dataset performance, pagination/query strategy and 100k+ records |
| 17.1 | planned | Storage quota, interrupted writes/import/backup and recovery |
| 17.2 | planned | Service Worker A→B update and cross-platform backup/restore regression |
| 17.3 | planned | Final security, supply-chain, secret scan and dependency audit |
| 17.4 | planned | Bundle/startup performance, platform regressions and full E2E |
| 17.5 | planned | Release candidate evidence and operational readiness reconciliation |
| 17.F | planned | Final READY/NOT READY gate for Nexora 1.0 |

The 12.5.C2 sequence is authoritative for the completed banking UX checkpoint. C2 and C3.0 are
complete; C3.1, C3.2, C3.3, C3.4, C3.5, C3.6, C3.7, C3.8, C3.9, C3.10, C3.11, C3.12, C3.13,
C3.14, C3.15, C3.16, C3.17, C3.18, C3.19, C3.20 and C3.21 are complete. C4.0–C4.10 are
complete with their own evidence; C4-F is closed with final regression evidence. C5 is closed with
`C5_FINAL_GATE_PASS`; Phase 13 is authorized only after the completed 12.5 release freeze. D, E
and F are complete; Phase 13 is authorized but not started.

Recovery checkpoint: `backup/pre-phase-12.3-worktree-20260809` at `862c2a7` is frozen and is not
an approved implementation. The Phase 12.3 work was recovered selectively on
`feature/phase-12.3` and then merged through PR #3; the checkpoint itself remains frozen.
