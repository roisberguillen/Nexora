# Repository map

Update this file only when package ownership, entry points or authoritative sources change.

| Package/surface | Responsibility | Entry points / central files | High-risk files | Tests | Authority |
|---|---|---|---|---|---|
| `apps/web` | React PWA and shared Tauri UI | `src/main.tsx`, `src/App.tsx` | startup, reset, security, cloud | colocated Vitest; `test/e2e` | PRD, UI roadmap, mockup integration |
| `apps/web/src-tauri` | Tauri native shell | `src/lib.rs`, `tauri.conf.json` | capabilities, Cargo config | `cargo check`; native smoke | ADR 0017, platform matrix |
| `apps/local-host` | local host foundation | package entry point | network exposure | package tests | ADR 0016 |
| `packages/application` | shared read/use-case layer | `src/index.ts` | command boundaries | colocated Vitest | architecture |
| `packages/domain` | entities and financial invariants | `src/index.ts` | Money, transfers, import rows | colocated Vitest | PRD, data model, ADRs |
| `packages/database` | repositories, migrations, browser adapters | `src/index.ts` | migrations, backup, OPFS/IndexedDB | colocated Vitest; persistence E2E | data model, ADR 0007–0013 |
| `packages/database-tauri` | native SQLite adapter | `src/openTauriLedger.ts` | SQL adapter, native path | colocated Vitest; Cargo/native smoke | ADR 0017 |
| `packages/importers` | parsing, mapping and deduplication | `src/index.ts` | normalization/fingerprint | colocated Vitest; import E2E | PRD 4.9–4.10, ADR 0004 |
| `packages/ui` | tokens and shared accessible UI | `src/index.ts` | global tokens | component/App Shell E2E | official Stitch design |
| `packages/config` | safe config and logging | `src/index.ts` | log allowlists, environment | colocated Vitest | security docs |
| `docs` | authoritative product/technical records | `CURRENT_SOURCES.md` | roadmap and ADR status | `pnpm codex:validate` | AGENTS reading order |

Targeted search rule: begin at the listed entry point and test; expand by at most five files with a
recorded reason.
