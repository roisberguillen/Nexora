# Phase 13.3 — Cross-platform desktop release matrix

Date: 2026-09-07
Result: `IN PROGRESS — macOS CI validation pending`
Routing: `ui_component / STANDARD / low`

## Scope

Validate the already implemented Tauri desktop foundation and packaging configuration against the
Windows/macOS target matrix defined by ADR 0017 and `docs/PLATFORM_MATRIX.md`. No runtime feature,
schema, migration, ledger behavior or UI redesign is in scope.

## Evidence

| Target | Check | Result | Evidence |
|---|---|---|---|
| Windows x64 | `pnpm --filter @nexora/web tauri build` | PASS | MSI and NSIS installers generated in 13.2 |
| Windows x64 | `cargo check --locked` | PASS | Native shell compiles on `stable-x86_64-pc-windows-msvc` |
| Windows x64 | startup smoke | PASS | `nexora.exe` alive for 5 seconds |
| macOS x64 | `cargo check --target x86_64-apple-darwin --locked` | BLOCKED | `objc2-exception-helper`: target C compiler `cc` unavailable on Windows |
| macOS arm64 | `cargo check --target aarch64-apple-darwin --locked` | BLOCKED | Same missing Apple target compiler/SDK prerequisite |

`rustup target add x86_64-apple-darwin aarch64-apple-darwin` completed, proving target standard
libraries are available; it does not provide Apple clang, SDKs or signing infrastructure.

To remove the environment dependency, `.github/workflows/ci.yml` now contains a `desktop-macos`
matrix on `macos-15-intel` (x64) and `macos-15` (arm64), with locked Cargo check and Tauri bundle steps. The workflow
also runs on `codex/**` branches so this change can be verified remotely before closure.

The full repository run exposed a timing-sensitive focus assertion in `TransactionsPage.test.tsx`.
The test now waits for the existing `requestAnimationFrame` focus restoration; application code is
unchanged. Local targeted and full verification both pass after this test-only hardening.

The first remote rerun passed unit/build/manifest gates but exceeded the CI `verify` timeout during
the full Playwright suite at 20 minutes. The timeout is now 45 minutes; test coverage is unchanged.

## Finding

| ID | Surface/reference | Category | Viewport | Current behavior | Expected behavior | Severity | Required correction | State |
|---|---|---|---|---|---|---|---|---|
| P13.3-01 | Windows release / macOS release matrix | platform build evidence | N/A | Windows is verified; local macOS cross-target compilation stops because the host lacks Apple `cc`/SDK | macOS x64 and arm64 builds must be verified on a macOS runner with Apple toolchain | P1 | Run the new `desktop-macos` CI matrix and record both remote results | OPEN — CI run pending |

No application defect or financial invariant violation was found. This task must not be marked
complete until the macOS evidence is available.

## Next action

Resume 13.3 after the macOS CI matrix completes, validate both architectures and record bundle
evidence. No subsequent phase is started here.
