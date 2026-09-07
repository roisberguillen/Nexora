# 14.3 — Android responsive and picker UI scope companion

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 14.3
Schermata: Import and Backup document picker surfaces
Route: `#imports`, `#backup`
Data: 2026-09-07
Reviewer/fase: Codex — Android responsive/pickers, 14.3
Flusso principale: shared responsive UI → semantic file input → preview/verification → explicit commit or restore
Modifiche: Verification-only slice; existing file inputs remain the least-privilege picker boundary and no UI implementation changed.
Esito: PASS

| Area | ID | Esito | Evidence |
| --- | --- | --- | --- |
| Universale | P14.3-U-01 | PASS | Import/Backup flows remain shared and accessible. |
| Mobile | P14.3-M-01 | PASS | 320/375/390 browser projects pass. |
| Desktop | P14.3-D-01 | PASS | 1024/1440 browser projects pass. |
| Tablet | P14.3-T-01 | PASS | 768 browser project pass. |
| Visuale | P14.3-V-01 | PASS | No visual implementation change; no overflow failures. |
| Ricerca | P14.3-R-01 | PASS | No search change. |
| Form | P14.3-F-01 | PASS | File inputs and dry-run forms remain usable. |
| Feedback | P14.3-FB-01 | PASS | Verification, cancel and restore feedback pass. |
| Accessibilità | P14.3-A-01 | PASS | Existing labels/semantics and responsive checks pass. |
| Finanza | P14.3-FN-01 | PASS | No financial behavior change. |
| Performance | P14.3-P-01 | PASS | Targeted browser suite completes without failure. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
Esito: PASS

Final evidence: 45 browser tests passed and 9 documented skips across all configured viewports.
