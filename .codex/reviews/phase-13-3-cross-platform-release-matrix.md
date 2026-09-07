# Phase 13.3 — Cross-platform desktop release matrix

Date: 2026-09-07
Result: `IN PROGRESS — macOS validation blocked by host toolchain`
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

## Finding

| ID | Surface/reference | Category | Viewport | Current behavior | Expected behavior | Severity | Required correction | State |
|---|---|---|---|---|---|---|---|---|
| P13.3-01 | Windows release / macOS release matrix | platform build evidence | N/A | Windows is verified; macOS cross-target compilation stops because the host lacks Apple `cc`/SDK | macOS x64 and arm64 builds must be verified on a macOS runner with Apple toolchain | P1 | Provide a macOS build runner/host, then run locked checks and signed/unsigned bundle smoke | OPEN — external environment |

No application defect or financial invariant violation was found. This task must not be marked
complete until the macOS evidence is available.

## Next action

Resume 13.3 on a macOS CI/host, validate both architectures and record bundle/startup evidence.
After that, continue with the next authorized roadmap task. No subsequent phase is started here.
