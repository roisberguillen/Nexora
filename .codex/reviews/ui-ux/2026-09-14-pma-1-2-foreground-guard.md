# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1  
Data: 2026-09-14  
Schermata: Nessuna nuova superficie UI  
Route: `#settings` — PMA-1.2 Android foreground lifecycle  
Flusso principale: il Local Hub del telefono viene arrestato quando la WebView passa in background
Reviewer/fase: Codex — PMA-1.2  
Modifiche: guard lifecycle globale; nessuna modifica a colori, font o layout approvati  
Esito: PASS

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-PMA-1.2 | PASS | Guard applicata solo al runtime Android; test dedicati verdi. |
| Mobile | M-PMA-1.2 | PASS | Il controllo Settings resta invariato; 18/18 test PMA-1 verdi. |
| Desktop | D-PMA-1.2 | N/A | Nessuna superficie desktop modificata. |
| Tablet | T-PMA-1.2 | N/A | Nessuna superficie responsive modificata. |
| Visuale | V-PMA-1.2 | N/A | Nessun cambiamento visivo. |
| Ricerca | R-PMA-1.2 | N/A | Nessuna ricerca modificata. |
| Form | F-PMA-1.2 | N/A | Nessun form modificato. |
| Feedback | FB-PMA-1.2 | PASS | Lo stop fail-safe non introduce notifiche o messaggi inattesi. |
| Accessibilità | A-PMA-1.2 | PASS | Nessun controllo interattivo o semantica accessibile modificata. |
| Finanza | FN-PMA-1.2 | PASS | Nessun accesso o modifica al ledger. |
| Performance | P-PMA-1.2 | PASS | Un solo listener lifecycle, rimosso dal cleanup del componente. |

P0 aperti: Nessuno

Gate result: PASS.

State reconciliation: PMA-1 remains in progress; signed physical verification, LAN/TLS and
permission gates remain open.
