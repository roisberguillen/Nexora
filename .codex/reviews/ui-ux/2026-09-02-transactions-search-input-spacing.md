# Audit UI/UX — Campo ricerca Movimenti mobile

Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Movimenti / Filtri movimenti
Route: `#transactions`
Flusso principale: ricerca di un movimento e cancellazione del testo
Reviewer/fase: Codex / correzione C3
Modifiche: margine e padding propri dell’input azzerati nel breakpoint mobile; spaziatura del pannello e dei filtri rapidi invariata.
Data: 2026-09-02
Esito: PASS

| Area | Superficie | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Campo ricerca | PASS | Stile condiviso e bordi invariati |
| Mobile | Campo a 320 px | PASS | Margine e padding computati a zero |
| Desktop | Vista desktop | PASS | Override limitato al breakpoint mobile |
| Tablet | Reflow dei filtri | PASS | Griglia fluida preservata |
| Visuale | Spaziatura input | PASS | Contenuto senza inset interno |
| Ricerca | Campo e cancellazione | PASS | Test E2E mantiene entrambe le azioni |
| Form | Controlli filtro | PASS | Gli altri controlli conservano gli inset |
| Feedback | Focus e stato | PASS | Focus visibile e feedback invariati |
| Accessibilità | Campo nominato | PASS | Ruolo searchbox e nome accessibile preservati |
| Finanza | Dati ledger | PASS | Nessun calcolo o dato modificato |
| Performance | CSS responsive | PASS | Una sola regola locale al breakpoint |

P0 aperti: Nessuno
