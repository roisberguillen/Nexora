# 13.3 — Cross-platform Release Matrix UI Scope Companion

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 13.3
Schermata: Desktop release matrix — UI scope companion
Route: `N/A — platform validation`
Data: 2026-09-07
Reviewer/fase: Codex — cross-platform release matrix, 13.3
Flusso principale: shared React UI → Tauri Windows/macOS shell → native persistence
Modifiche: CI-only macOS packaging validation matrix uses current x64/arm64 runner labels and a 45-minute verification timeout; one focus assertion was synchronized with the existing UI requestAnimationFrame; root horizontal overflow is clipped without changing layout or interaction behavior, Linux visual baselines are aligned with the already-approved desktop surface, and visual assertions use a documented cross-renderer pixel-ratio tolerance.
Esito: PASS

| Area | ID | Esito | Evidence |
| --- | --- | --- | --- |
| Universale | P13.3-U-01 | PASS | Shared React/UI contract unchanged. |
| Mobile | P13.3-M-01 | PASS | No mobile source or behavior change. |
| Desktop | P13.3-D-01 | PASS | Shared desktop shell remains behaviorally unchanged; both macOS packaging targets pass remotely. |
| Tablet | P13.3-T-01 | PASS | Shared layout constraints unchanged. |
| Visuale | P13.3-V-01 | PASS | Root overflow hardening does not alter the approved layout; Linux baselines now match the current approved desktop surface already represented by Win32 evidence. |
| Ricerca | P13.3-R-01 | PASS | No search behavior change. |
| Form | P13.3-F-01 | PASS | No form behavior change. |
| Feedback | P13.3-FB-01 | PASS | No feedback behavior change. |
| Accessibilità | P13.3-A-01 | PASS | Existing C3/C4/D evidence remains authoritative. |
| Finanza | P13.3-FN-01 | PASS | No ledger or amount behavior change. |
| Performance | P13.3-P-01 | PASS | No UI performance change; platform packaging blocker is tracked separately. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
Esito: PASS

Final evidence: CI run `34156198571` verified the shared UI on Linux Playwright and Tauri bundles
on both macOS architectures; the next task is not authorized until registered in roadmap progress.
