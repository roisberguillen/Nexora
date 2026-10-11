# Checkpoint — Android Local Hub LAN runtime debug

- Date: 2026-10-11
- Branch: codex/pc-manager-local-browser
- Scope: verify the installed signed APK, Wi-Fi address, Local Hub listener and LAN start flow
  using the connected Pixel 9 without clearing app data.
- Constraints: no main changes, no uninstall/reset, no secrets or real ledger data.
- Initial evidence: ADB device `46060DLAQ002XQ` authorized; app version `0.5.0-1`; `wlan0`
  `10.2.32.144/24`; cellular `rmnet1` present; port `43173` not listening; app not focused.
- Reproduction: after navigating to Settings and tapping the LAN start control, runtime stayed
  `stopped`; the biometric-only Keystore path failed before listener startup.
- Change: generate the PMA-3.2 TLS identity only in memory for the explicit runtime lifetime;
  pairing and fingerprint are renewed after each start.
- Verification: CI signed APK from run `38130206673` installed with `adb install -r`; the
  Settings control reached `running`, listener `43173` was present, and the PC reached that
  listener over the phone LAN. No crash markers were found and app data was preserved.
