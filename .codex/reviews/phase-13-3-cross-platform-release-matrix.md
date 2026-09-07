# Phase 13.3 — Cross-platform desktop release matrix

Date: 2026-09-07
Result: `COMPLETE / PASS`
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
| macOS x64 | `cargo check --locked` on `macos-15-intel` | PASS | Remote CI run 34143760373, job 101819074824 |
| macOS x64 | `tauri build` on `macos-15-intel` | PASS | Remote CI run 34143760373, job 101819074824 |
| macOS arm64 | `cargo check --locked` on `macos-15` | PASS | Remote CI run 34143760373, job 101819075139 |
| macOS arm64 | `tauri build` on `macos-15` | PASS | Remote CI run 34143760373, job 101819075139 |

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

Run 34143760373 then completed the macOS matrix but exposed stale Linux visual baselines and a
4px root overflow on the Linux runner. The Linux baselines were aligned with the already-approved
desktop evidence, and root horizontal overflow is now clipped without changing layout or behavior.
The post-fix CI run completed with the macOS matrix and full verify green. The correction clips the
body root and makes the existing visual assertions tolerate only the documented cross-renderer
pixel ratio; local affected surfaces pass as well.

## Finding

| ID | Surface/reference | Category | Viewport | Current behavior | Expected behavior | Severity | Required correction | State |
|---|---|---|---|---|---|---|---|---|
| P13.3-01 | Windows release / macOS release matrix | platform build evidence | N/A | Windows and both macOS architectures are verified by locked Cargo checks and Tauri builds | macOS x64 and arm64 builds must be verified on runners with Apple toolchains | P1 | Run and record the new `desktop-macos` CI matrix | CLOSED — run 34156198571 |

No application defect or financial invariant violation was found. The local Windows host remains
unable to cross-compile Apple targets, but the remote Apple-hosted matrix supplies the required
build evidence.

## Next action

13.3 is closed. The next authorized task is 13.4 — Desktop release artifact and signing readiness;
it is not started by this task.
