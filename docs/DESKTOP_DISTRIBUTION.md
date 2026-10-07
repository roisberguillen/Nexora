# Nexora desktop distribution

Nexora desktop is a native Tauri application. Once installed, it is started by double-clicking
the installed application or its Start Menu/Finder entry; no PowerShell, terminal or `pnpm`
command is required.

## Supported desktop outputs

- Windows: NSIS installer and MSI, produced by the `desktop-windows` CI job.

La distribuzione nativa macOS è fuori scope per il momento e non viene verificata o pubblicata
dalla pipeline CI.

## Installation

1. Scarica l’artifact Windows prodotto dal job `desktop-windows`.
2. Avvia l’installer `.exe` oppure apri il file `.msi`; Nexora sarà disponibile dal menu Start.

Unsigned development artifacts may show the operating system's security warning. Production
distribution should add Windows code signing using external credentials; secrets must never be
stored in this repository.

## Local Windows build

From the repository root, `pnpm --filter @nexora/web tauri build` creates the native bundles under
`apps/web/src-tauri/target/release/bundle/`. The resulting installer is the user-facing artifact;
the standalone executable is useful for diagnostics and does not require a terminal once launched.
