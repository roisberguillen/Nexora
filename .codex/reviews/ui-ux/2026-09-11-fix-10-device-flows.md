# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-11
Schermata: Android release — dashboard, conti, movimenti, trasferimenti, profilo e backup
Route: tauri_android / ADVANCED
Flusso principale: smoke Pixel 9 su APK release firmato
Reviewer/fase: Codex — FIX.10

Modifiche: verifica visuale e interattiva delle superfici Android interessate; aggiunto dialogo nativo Salva con nome per l’export `.nexora-backup`; nessun cambio a colori o font approvati.

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Navigazione disponibile dopo restart. |
| Mobile | M-01 | PASS | Pixel 9 1080×2424; azioni primarie raggiungibili. |
| Desktop | D-01 | N/A | Nessuna modifica desktop; gate web esistente. |
| Tablet | T-01 | N/A | Nessuna modifica tablet; gate responsive esistente. |
| Visuale | V-01 | PASS | Colori/font approvati invariati. |
| Ricerca | R-01 | N/A | Non coinvolta nel flusso. |
| Form | F-01 | PASS | Conto, movimento, trasferimento, passphrase, destinazione backup e mapping import inviati. |
| Feedback | FB-01 | PASS | Feedback di salvataggio, trasferimento, backup, restore e deduplica import visibili. |
| Accessibilità | A-01 | PASS | UI dump con etichette per le azioni testate; gate WCAG completo nei test repository. |
| Finanza | FIN-01 | PASS | Trasferimento a due gambe escluso da entrate/uscite. |
| Performance | P-01 | PASS | Bootstrap release senza errori fatal/recovery. |

P0 aperti: Nessuno
P1/P2 aperti: commit/undo import e release signed post-fix non completati in questo pass; offline locale PASS.
Esito: PASS
