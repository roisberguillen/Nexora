# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-12
Schermata: PC Manager revoca e recovery
Route: `/v1/pairing/revoke`
Flusso principale: device paired → revoca esplicita → token e sessione invalidati
Reviewer/fase: Codex — PM-6.6
Modifiche: aggiunta revoca autorizzata del device con invalidazione atomica delle sessioni associate; nessuna credenziale o ledger nei log.

## Verifiche

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Test HTTP revoca device e sessione PASS. |
| Mobile | M-01 | N/A | UI recovery telefono ancora aperta. |
| Desktop | D-01 | N/A | Nessun layout desktop modificato. |
| Tablet | T-01 | N/A | Nessuna superficie tablet modificata. |
| Visuale | V-01 | N/A | Nessun token visuale modificato. |
| Ricerca | R-01 | N/A | Nessuna ricerca modificata. |
| Form | F-01 | N/A | Nessun form runtime modificato. |
| Feedback | FB-01 | PASS | Revoca non autorizzata è rifiutata; target revocato restituisce stato esplicito. |
| Accessibilità | A-01 | N/A | UI non ancora collegata. |
| Finanza | FN-01 | PASS | La revoca non accede al ledger. |
| Performance | P-01 | PASS | Revoca esegue solo rimozione device/sessioni. |

## Criticità e decisione

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS_CON_P1
