# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-12
Schermata: PC Manager sessione e recovery — contratto backend
Route: `/v1/session/*` (contratto non ancora esposto)
Flusso principale: pairing autorizzato → passcode → sessione con scadenza → logout/revoca
Reviewer/fase: Codex — PM-6.1
Modifiche: aggiunto il registro fail-closed per passcode/sessioni con salt, derivazione iterata, rate limit, scadenza e revoca; nessuna UI runtime modificata.

## Verifiche

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Contratto isolato e testato nel crate Local Hub. |
| Mobile | M-01 | N/A | Wiring Pixel/UI è fase successiva. |
| Desktop | D-01 | N/A | Nessun layout desktop modificato. |
| Tablet | T-01 | N/A | Nessuna superficie tablet modificata. |
| Visuale | V-01 | N/A | Nessun token visuale modificato. |
| Ricerca | R-01 | N/A | Nessuna ricerca modificata. |
| Form | F-01 | N/A | Nessun form runtime modificato. |
| Feedback | FB-01 | PASS | Rate limit, invalid passcode, expiry e revocation hanno esiti espliciti. |
| Accessibilità | A-01 | N/A | UI non ancora collegata. |
| Finanza | FN-01 | PASS | Il registro non contiene payload ledger o dati finanziari. |
| Performance | P-01 | PASS | Derivazione iterata è coperta da test e resta fuori dal percorso ledger locale. |

## Criticità e decisione

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS_CON_P1
