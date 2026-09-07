# Phase 13.2 — Desktop packaging and distribution readiness

Date: 2026-09-07
Result: `13.2 = PASS`
Routing: `tauri_desktop / ADVANCED / low`

## Scope

This slice validates Windows distribution packaging for the existing Tauri desktop shell. No
runtime feature, ledger schema, migration, permission, signing credential or user-data behavior
was introduced.

## Findings and correction

The initial distributive build exposed two packaging-only gaps:

1. `bundle.active` was `false`, so `tauri build` produced only the executable and no installer.
2. The Tauri version `0.5.0-rc.1` was rejected by WiX because MSI prerelease identifiers must be
   numeric-only; after that was corrected, the existing icon set was not explicitly wired into the
   bundle configuration.

The minimal correction enables bundling, uses the numeric native package version `0.5.0-1`, and
declares the existing ICO/PNG icons explicitly. The workspace release version remains
`0.5.0-rc.1`; this is a native installer metadata constraint, not a domain or web release change.

## Evidence

- `cargo check --locked` in `apps/web/src-tauri`: PASS.
- `pnpm --filter @nexora/web tauri build`: PASS.
- MSI: `apps/web/src-tauri/target/release/bundle/msi/Nexora_0.5.0-1_x64_en-US.msi`, 5,906,432 bytes.
- NSIS: `apps/web/src-tauri/target/release/bundle/nsis/Nexora_0.5.0-1_x64-setup.exe`, 4,634,714 bytes.
- Desktop startup smoke: `nexora.exe` remained alive for 5 seconds and exited cleanly after stop.
- `pnpm verify`: PASS — 633 tests passed, 4 skipped; format, lint, typecheck and build passed.
- No financial invariants, minor-unit representation, migrations or persistence behavior changed.

The Vite chunk-size advisory remains a non-blocking warning already present in the build output.

## Findings status

| Severity | Open | Closed |
|---|---:|---:|
| P0 | 0 | 0 |
| P1 | 0 | 0 |
| P2 | 0 | 2 |

Closed P2 findings are the packaging activation and native metadata/icon wiring gaps found by
this slice. They are configuration-level and are covered by the successful bundle gate.

## Next slice

`13.3 — Cross-platform desktop release matrix` is recommended next and is not started by 13.2.
It should validate platform-specific artifact configuration and release prerequisites separately.
