# Nexora desktop distribution

Nexora desktop is a native Tauri application. Once installed, it is started by double-clicking
the installed application or its Start Menu/Finder entry; no PowerShell, terminal or `pnpm`
command is required.

## Supported desktop outputs

- Windows: NSIS installer and MSI, produced by the `desktop-windows` CI job.
- macOS Intel: DMG/app, produced by the `macos-15-intel` CI job.
- macOS Apple Silicon: DMG/app, produced by the `macos-15` CI job.

The CI artifacts are generated per operating system and architecture. A Windows executable cannot
run natively on macOS, so the correct installer must be downloaded for the computer being used.

## Installation

1. Download the artifact matching the operating system and CPU architecture.
2. Windows: run the `.exe` installer or open the `.msi`; Nexora is then available from the Start Menu.
3. macOS: open the `.dmg`, drag Nexora to Applications, then launch it from Finder or Spotlight.

Unsigned development artifacts may show the operating system's security warning. Production
distribution should add Windows code signing and Apple Developer ID signing/notarization using
external credentials; secrets must never be stored in this repository.

## Local Windows build

From the repository root, `pnpm --filter @nexora/web tauri build` creates the native bundles under
`apps/web/src-tauri/target/release/bundle/`. The resulting installer is the user-facing artifact;
the standalone executable is useful for diagnostics and does not require a terminal once launched.
