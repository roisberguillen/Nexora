# UI/UX change review
Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-14
Schermata: App Shell — campo ricerca mobile
Route: `shell` e hash routes reali
Flusso principale: header mobile → campo ricerca → dialog ricerca globale
Reviewer/fase: Codex — mobile search sizing refinement
Modifiche: input mobile esteso al 100% del label, con icona decorativa sovrapposta e padding interno coerente.

## Verifiche

| Area | ID | Esito | Evidenza / N.A. |
|---|---|---|---|
| Universale | U-01 | PASS | La correzione è confinata allo stile del campo ricerca mobile. |
| Mobile | M-01 | PASS | Input e label condividono il medesimo rettangolo a 320–412 px. |
| Desktop | D-01 | PASS | Nessuna regola desktop modificata. |
| Tablet | T-01 | PASS | Breakpoint mobile invariato. |
| Visuale | V-01 | PASS | Bordo, focus e area cliccabile coincidono con il contenitore. |
| Ricerca | R-01 | PASS | Il campo continua ad aprire il dialog globale editabile. |
| Form | F-01 | N/A | Nessun form finanziario modificato. |
| Feedback | FB-01 | PASS | Focus visibile mantenuto senza clipping. |
| Accessibilità | A-01 | PASS | Nome accessibile e semantica `searchbox` invariati. |
| Finanza | FN-01 | PASS | Nessun accesso a dati o ledger. |
| Performance | P-01 | PASS | Solo CSS, nessuna dipendenza o logica aggiunta. |

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS
