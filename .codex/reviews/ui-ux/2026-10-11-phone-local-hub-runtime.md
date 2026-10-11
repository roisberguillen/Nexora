# Android Local Hub runtime — UI/UX review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-10-11
Schermata: Impostazioni — Local Hub del telefono
Route: settings
Flusso principale: Impostazioni → avvio Local Hub LAN → runtime HTTPS o errore
Reviewer/fase: Codex — Local Hub runtime bug fix
Modifiche: Nessuna modifica visuale; il fix cambia solo il backend nativo del certificato temporaneo.

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Il flusso mantiene il pulsante, stato runtime e feedback esistenti. |
| Mobile | M-01 | PASS | Nessun layout o target touch modificato. |
| Desktop | D-01 | N/A | Nessuna superficie desktop modificata. |
| Tablet | T-01 | N/A | Nessun layout tablet modificato. |
| Visuale | V-01 | N/A | Nessun token o stile modificato. |
| Ricerca | R-01 | N/A | La schermata non offre ricerca. |
| Form | F-01 | N/A | La schermata non contiene un form. |
| Feedback | FB-01 | PASS | Il feedback esistente resta disponibile per successo o errore nativo. |
| Accessibilità | A-01 | PASS | La semantica del pulsante e dell'alert resta invariata. |
| Finanza | FN-01 | N/A | Nessun dato finanziario coinvolto. |
| Performance | P-01 | PASS | Il fix evita il prompt biometrico nel percorso di avvio e non aggiunge polling. |

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS