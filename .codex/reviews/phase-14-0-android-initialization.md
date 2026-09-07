# 14.0 — Tauri Android initialization and native baseline

Result: `COMPLETE / PASS`

## Scope

Initialized the Tauri Android project for the existing Nexora application without introducing
new product behavior. The generated Android project remains reproducible via the official Tauri
initialization command and is intentionally ignored by the repository's generated-artifact rule.

| Check | Result | Evidence |
|---|---|---|
| Android environment | PASS | Per-user JDK 17, Android command-line tools, platform-tools, Android platform 36, build-tools 35 and NDK 27.2 installed locally. |
| Tauri initialization | PASS | `tauri android init --ci --skip-targets-install` generated `apps/web/src-tauri/gen/android`. |
| Rust Android target | PASS | `rustup target add aarch64-linux-android`; Rust library compiled during Android build. |
| Gradle packaging baseline | PASS | `gradlew.bat assembleArm64Debug -x rustBuildArm64Debug --no-daemon` → BUILD SUCCESSFUL; `app-arm64-debug.apk` produced. |
| Full Tauri APK command | BLOCKED/diagnostic | Tauri symlink creation requires Windows Developer Mode/SeCreateSymbolicLinkPrivilege; Kotlin incremental daemon also reports cross-drive cache roots. |
| Financial invariants | PASS | No schema, repository, ledger or accounting behavior changed. |

P0: 0  
P1: 0  
P2: 0

## Evidence

- Official Tauri init completed after configuring JDK/SDK/NDK environment variables for the shell.
- Rust Android build produced `libnexora_lib.so` for `aarch64-linux-android`.
- Gradle assembled the arm64 debug APK successfully using the produced native library.
- The full Tauri command's symlink limitation is environment-specific and remains recorded for
  14.5/device packaging; it is not hidden or reclassified as a successful full command.

Next: `14.1 — Android SQLite native adapter, shared schema and migration parity`.
