# 14.5 — Android APK/AAB packaging and device verification

Result: `COMPLETE / PASS` for locally verifiable packaging; device verification `N/A`.

| Check | Result | Evidence |
|---|---|---|
| Rust Android release | PASS | `cargo build --target aarch64-linux-android --release --locked` with NDK clang/linker. |
| APK release packaging | PASS | Gradle `assembleArm64Release` completed successfully; `app-arm64-release-unsigned.apk` produced (17,230,860 bytes). |
| AAB release packaging | PASS | Gradle `bundleArm64Release` completed successfully; `app-arm64-release.aab` produced (8,010,525 bytes). |
| Signing | NOT CLAIMED | APK is explicitly unsigned; no production signing key was present. |
| Emulator/device | N/A | `adb devices -l` reported no attached devices or running emulator. |
| Financial invariants | PASS | No application ledger/schema/migration behavior changed. |

P0: 0  
P1: 0  
P2: 0

The full Tauri Android command remains environment-limited by Windows symlink privilege and
cross-drive Kotlin incremental-cache diagnostics; the underlying Rust and Gradle artifacts were
verified separately and this distinction is preserved.

Next: `14.F — Final Android gate and release evidence`.
