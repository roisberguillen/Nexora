# UI/UX change review
Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-14
Schermata: App Shell — header e menu mobile
Route: `shell` e hash routes reali
Flusso principale: header mobile → campo ricerca/menu → sheet menu → route
Reviewer/fase: Codex — mobile navigation refinement
Modifiche: sheet mobile dedicato con catalogo route condiviso, ricerca centrata come campo, profilo rimosso dall’header e spaziatura simmetrica.

## Verifiche

| Area | ID | Esito | Evidenza / N.A. |
|---|---|---|---|
| Universale | U-01 | PASS | Catalogo route condiviso; 18 destinazioni presenti nello sheet. |
| Mobile | M-01 | PASS | Sheet verificato a 320, 375, 390 e 412 px; bottom navigation invariata. |
| Desktop | D-01 | PASS | Sidebar e TopHeader desktop restano separati e invariati. |
| Tablet | T-01 | PASS | Breakpoint 768 px mantiene il passaggio coerente tra superfici. |
| Visuale | V-01 | PASS | Campo ricerca centrato, gap e margini laterali uniformi; input a tutta altezza. |
| Ricerca | R-01 | PASS | Campo `Ricerca globale` con placeholder `Cerca…` apre il dialog editabile. |
| Form | F-01 | N/A | Nessun form finanziario modificato. |
| Feedback | FB-01 | PASS | Backdrop, stato aperto/chiuso e chiusura dopo route verificati. |
| Accessibilità | A-01 | PASS | Nomi accessibili, `aria-expanded`, focus trap, Escape e ritorno focus. |
| Finanza | FN-01 | PASS | Apertura/navigazione non scrivono nel ledger; fixture sintetiche. |
| Performance | P-01 | PASS | Nessuna dipendenza o percorso dati aggiunto; build PASS. |

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS
