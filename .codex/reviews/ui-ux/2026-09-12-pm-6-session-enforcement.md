# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-12
Schermata: PC Manager session gate
Route: `/v1/session/configure`, `/v1/session/unlock`, `/v1/session/logout`, `/v1/operations`
Flusso principale: device paired → configura passcode → unlock → sync autorizzato → logout
Reviewer/fase: Codex — PM-6.3
Modifiche: configurazione passcode da device paired, session header obbligatorio sulle API sync quando configurato, controllo server-side dell’orario e test HTTP end-to-end del gate.

## Verifiche

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Test HTTP verifica configurazione, unlock, sync autorizzato e logout. |
| Mobile | M-01 | N/A | UI Pixel ancora da collegare al contratto. |
| Desktop | D-01 | N/A | Nessun layout desktop modificato. |
| Tablet | T-01 | N/A | Nessuna superficie tablet modificata. |
| Visuale | V-01 | N/A | Nessun token visuale modificato. |
| Ricerca | R-01 | N/A | Nessuna ricerca modificata. |
| Form | F-01 | N/A | Form telefono ancora da implementare. |
| Feedback | FB-01 | PASS | Fail-closed su sessione assente, passcode non configurato, expiry e rate limit. |
| Accessibilità | A-01 | N/A | UI non ancora collegata. |
| Finanza | FN-01 | PASS | Sync senza sessione non accede all’operation log; nessun payload nei log. |
| Performance | P-01 | PASS | Derivazione passcode protetta dal rate limit e fuori dalle richieste sync valide. |

## Criticità e decisione

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS_CON_P1
