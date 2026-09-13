# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-13
Schermata: PM-8 device and desktop gate preflight
Route: Desktop installer / Pixel 9 ADB preflight
Flusso principale: installer artefacts → ADB install/launch → Local Hub host gate
Reviewer/fase: Codex — PM-8 preflight
Modifiche: invito pairing, autorizzazione/revoca device e gestione passcode/sessione aggiunti alla Settings UI; registrati anche installazione/avvio release sul Pixel 9, il gate loopback, il ramo TLS runtime e il provisioning LAN esplicito del Local Hub.

## Verifiche

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Installer artefacts presenti e hashati. |
| Mobile | M-01 | PASS | Pixel 9 autorizzato; `adb install -r` riuscito, MainActivity foreground e logcat senza marker di crash. |
| Desktop | D-01 | PASS | MSI/NSIS Windows x64 prodotti e verificati. |
| Tablet | T-01 | N/A | Nessun device tablet collegato. |
| Visuale | V-01 | PASS | WebView Android renderizza App Shell e route iniziale; PC Manager/Local Hub smoke resta aperto. |
| Ricerca | R-01 | N/A | Nessuna ricerca modificata. |
| Form | F-01 | PASS | Invito pairing incollabile, stato busy e feedback accessibile verificati nei test Settings. |
| Feedback | FB-01 | PASS | Device online registrato; Tauri mostra stop dopo l’avvio e il Local Hub loopback risponde su health/browser. |
| Accessibilità | A-01 | N/A | Verifica device/browser reale ancora aperta. |
| Finanza | FN-01 | PASS | Gate USB pairing/sessione eseguito con operazioni sintetiche; nessun dato reale modificato. |
| Performance | P-01 | N/A | Performance LAN reale ancora aperta. |
| TLS/LAN | N-01 | PARTIAL | UI Tauri per indirizzo LAN e selezione PEM/key verificata; HTTPS health 200 dal PC. Pixel sulla stessa subnet, ma firewall Windows `Public` con regole Nexora `Block` impedisce il probe TCP; serve consenso amministrativo mirato. |

## Criticità e decisione

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS_CON_P1

Nota: pairing/passcode UI, gate USB, loopback e provisioning TLS LAN verificati parzialmente; PM-8 finale resta aperta per firewall autorizzato, browser LAN, sync/recovery completa e verifica dal Pixel.
