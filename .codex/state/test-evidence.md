# Test evidence

Keep only the latest relevant evidence per completed phase.

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
