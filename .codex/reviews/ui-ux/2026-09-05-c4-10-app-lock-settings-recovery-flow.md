# 12.5.C4.10 — App Lock, impostazioni, cestino, reset, startup e recovery

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.C4.10
Schermata: App Lock, impostazioni, cestino, reset, startup e recovery
Route: `#privacy-security`, `#settings`, `#backup`, `#accounts`, `#transactions`
Data: 2026-09-05
Reviewer/fase: Codex — Security + UI/UX + QA, 12.5.C4.10
Flusso principale: stato valido → lock → preferenze → cestino/restore → reset → startup vuoto → restore
Modifiche: nuovo E2E di lifecycle completo e riconciliazione documentale C4.10.
Esito: PASS
Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Branch: `codex/phase-12-5-0-checkpoint`
Commit iniziale: `f13e426d6bef8719f45057c087c29aaaeeeb39b7`
Risultato: `FLOW_AUDIT_PASS`

## Ambiente e fixture

- Chromium Playwright, viewport `390×844` e `1440×1000`; build preview locale su `127.0.0.1`.
- Fixture sintetica `Carica dati dimostrativi`: 4 conti, 5 categorie, 6 movimenti ordinari inclusa
  una spesa destinata al cestino, 2 gambe di trasferimento collegate e preferenze iniziali note.
- Backup `.nexora-backup` creato e verificato dalla UI con passphrase sintetica; nessuna rete o dato reale.
- Snapshot di riconciliazione: testo accessibile delle tabelle Conti e della lista Movimenti, usato come
  fingerprint stabile prima del lock e confrontato dopo trash/restore e restore post-reset.

## Percorso eseguito

1. Seed locale, snapshot iniziale e backup cifrato scaricato.
2. Tema scuro, testo grande e riduzione animazioni salvati e riletti dopo reload.
3. App Lock attivato con timeout di 1 minuto; lock manuale, navigazione diretta bloccata, PIN errato,
   PIN corretto e reload verificati. Il valore persistito non contiene il PIN in chiaro.
4. Movimento ordinario spostato nel cestino, verificato fuori dalle viste attive e ripristinato;
   snapshot invariato.
5. Reset annullato con Escape; frase errata non abilita la CTA. Reset confermato con backup verificato,
   PIN e doppio submit; stato vuoto rileltto dopo reload senza ricomparsa dei dati.
6. Backup precedente verificato in sola lettura e ripristinato con conferma; App Lock nuovamente richiesto
   dopo il restore, poi ledger, conti, movimenti e snapshot riconciliati. Lock infine disabilitato con PIN.

## Evidenze e gate

| Area | ID | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Lifecycle UI completo con snapshot iniziale e restore finale identico. |
| Mobile | M-01 | PASS | Flusso completo eseguito su Chromium 390 senza overflow o blocchi di navigazione. |
| Desktop | D-01 | PASS | Flusso completo eseguito su Chromium 1440 con reload e restore. |
| Tablet | T-01 | PASS | Regressione collegata C3/settings/startup eseguita sui profili disponibili; nessuna failure. |
| Visuale | V-01 | PASS | Lock screen, settings, dialog reset e stati vuoto/successo leggibili e coerenti. |
| Ricerca | R-01 | PASS | Navigazione diretta a route sensibili non aggira il lock e il ledger torna rileggibile dopo unlock. |
| Form | F-01 | PASS | PIN, preferenze, frasi di conferma e file backup validano input e doppio submit. |
| Feedback | FB-01 | PASS | Errori PIN/frase, loading, stato vuoto, conferma e successo sono esposti alla UI. |
| Accessibilità | A-01 | PASS | Locator semantici, dialog Escape/focus e schermata lock senza dati sensibili verificati. |
| Finanza | FN-01 | PASS | Conti, categorie, movimenti e trasferimento restano invariati nel fingerprint post-restore. |
| Performance | P-01 | PASS | Nessuna attesa temporale fragile; build e suite completa verdi. |

| Area | Esito | Evidenza |
| --- | --- | --- |
| App Lock/privacy | PASS | Nessun contenuto finanziario nella schermata bloccata; errore generico; focus e PIN corretto/errato. |
| Preferenze | PASS | Tema, scala testo e riduzione animazioni persistono dopo reload e non cambiano il ledger. |
| Cestino | PASS | Soft delete e restore UI senza variazione dello snapshot. |
| Reset/recovery | PASS | Annullamento, frase errata, conferma, doppio submit, startup vuoto e restore del backup. |
| Responsive | PASS | Nuovo flusso E2E su 390 e 1440; regressioni collegate su 390/1440 verdi. |
| Console | PASS | Nessun `pageerror` o errore console osservato. |
| Startup controllato | PASS | Unit test per storage/database/schema/bootstrap/recovery/retry idempotente. |

## Test eseguiti

- `pnpm build`: PASS.
- `pnpm vitest run apps/web/src/security apps/web/src/settings apps/web/src/startup packages/database/src packages/application/src`: 37 file, 236 pass, 0 fail.
- `pnpm exec playwright test test/e2e/c4-backup-restore-drive-flow.spec.ts --project=chromium-1440`: 2 pass, 0 fail.
- Regressione C3/security/settings/startup/transactions su 390/1440: 42 pass, 4 skip motivati, 0 fail.
- `pnpm exec playwright test test/e2e/c4-app-lock-settings-recovery-flow.spec.ts --project=chromium-390 --project=chromium-1440`: 2 pass, 0 fail.
- `pnpm exec playwright test`: 666 test, 433 pass, 233 skip, 0 fail; gli skip sono condizionati dai
  profili viewport/backend dichiarati dalla suite.

P0 aperti: Nessuno  
P1 aperti: Nessuno  
P2 aperti: Nessuno

## Stato finale

`12.5.C4.10 COMPLETE` — `FLOW_AUDIT_PASS`. La prossima attività è `12.5.C4-F — Regressione completa e chiusura C4`.
