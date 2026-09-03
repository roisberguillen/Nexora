# C4.1 — Mobile quick action placement follow-up

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-03
Schermata: App Shell — navigazione mobile e quick action
Route: `shell` e hash routes reali
Flusso principale: apertura shell mobile → quick action sopra il footer → apertura sheet → Escape → ritorno focus
Reviewer/fase: Codex — C4.1 UI follow-up
Modifiche: separato il pulsante `Nuova operazione` dal landmark della bottom navigation, ridotta la griglia del footer a cinque colonne e mantenuto il posizionamento responsive con safe area.

## Verifica

| Area | Superficie | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Trigger | PASS | Il trigger conserva nome accessibile e comportamento di apertura/chiusura. |
| Mobile | Layout | PASS | Quick action fixed sopra il footer e allineata a destra su viewport mobili. |
| Desktop | Layout | N/A | Il trigger resta nascosto oltre il breakpoint mobile; nessuna superficie desktop modificata. |
| Tablet | Layout | PASS | La disposizione resta coerente fino al breakpoint mobile previsto. |
| Visuale | Tokens | PASS | Colori, font e token esistenti invariati; solo posizione e griglia aggiornate. |
| Ricerca | Shell | N/A | Nessuna modifica alla ricerca globale. |
| Form | Sheet | N/A | Nessun form modificato. |
| Feedback | Sheet | PASS | Lo sheet continua ad aprirsi e chiudersi con Escape. |
| Accessibilità | Focus | PASS | Il quick action è separato dal landmark nav e il focus ritorna al trigger. |
| Finanza | Dominio | N/A | Nessuna logica di importi, conti o movimenti modificata. |
| Performance | CSS | PASS | Solo CSS di layout e un controllo già esistente; nessun nuovo caricamento. |

P0 aperti: Nessuno
Esito: PASS
