# 12.5.E.3 — Data Integrity UI Scope Companion

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.E.3
Schermata: Data integrity and recovery — UI scope companion
Route: `N/A — nessuna modifica UI/runtime`
Data: 2026-09-07
Reviewer/fase: Codex — integrity/recovery gate, 12.5.E.3
Flusso principale: backup → verify → restore → rollback → reopen
Modifiche: nessuna modifica runtime o UI; evidenza nel report E.3.
Esito: PASS

| Area | ID | Esito | Evidence |
| --- | --- | --- | --- |
| Universale | E3-U-01 | PASS | Recovery UI flows covered by E2E. |
| Mobile | E3-M-01 | PASS | Backup/recovery mobile paths unchanged. |
| Desktop | E3-D-01 | PASS | Backup/recovery desktop paths unchanged. |
| Tablet | E3-T-01 | PASS | Responsive recovery evidence preserved. |
| Visuale | E3-V-01 | PASS | No tokens or visual styles changed. |
| Ricerca | E3-R-01 | PASS | No search interaction changed. |
| Form | E3-F-01 | PASS | Passphrase/file forms unchanged and tested. |
| Feedback | E3-FB-01 | PASS | Verify/restore feedback remains covered. |
| Accessibilità | E3-A-01 | PASS | Dialog/focus recovery coverage preserved. |
| Finanza | E3-FN-01 | PASS | Restore and balance invariants pass. |
| Performance | E3-P-01 | PASS | Native and persistence gates pass. |

P0 aperti: Nessuno
P1 aperti: Nessuno
Esito: PASS
