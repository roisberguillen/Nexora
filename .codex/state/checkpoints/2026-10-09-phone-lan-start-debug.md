# Checkpoint — Android Local Hub LAN start debug

- Date: 2026-10-09
- Branch: codex/pc-manager-local-browser
- Scope: prefer Wi-Fi interface over cellular/VPN during phone Local Hub LAN start and expose start errors in the Android settings section.
- Constraints: no ledger, sync protocol or TLS changes; no data reset or secret access.
- Evidence: Pixel 9 USB/ADB showed wlan0=10.2.32.144 and rmnet1=10.78.249.27; runtime remained stopped after UI tap.