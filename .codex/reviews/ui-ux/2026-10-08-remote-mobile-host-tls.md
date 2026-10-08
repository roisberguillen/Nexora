# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-10-08
Schermata: Impostazioni — Local Hub e pairing
Route: Settings
Flusso principale: Pairing con invito phone, errore TLS e stato connessione
Reviewer/fase: Codex — gate pre-commit
Modifiche: Protocollo pairing versionato, certificato pubblico nell’invito, richiesta nativa pinning TLS e credenziali vault.

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Il testo di pairing resta breve e lo stato di errore è esplicito. |
| Mobile | M-01 | N/A | Nessun layout mobile modificato. |
| Tablet | T-01 | N/A | Nessun layout tablet modificato. |
| Desktop | D-01 | PASS | Il flusso Settings conserva pairing, stato host e messaggio di errore. |
| Visuale | V-01 | N/A | Nessun colore, font o layout modificato. |
| Form | F-01 | PASS | Invito con protocollo non supportato viene rifiutato prima della rete. |
| Ricerca | R-01 | N/A | Nessun flusso di ricerca modificato. |
| Feedback | FB-01 | PASS | Pairing fallito e certificato non attendibile producono stato di errore. |
| Accessibilità | A-01 | N/A | Nessun nuovo controllo UI introdotto. |
| Finanza | FN-01 | N/A | Nessun calcolo finanziario modificato. |
| Performance | P-01 | PASS | Le richieste LAN usano il bridge nativo solo in runtime Tauri. |

P0 aperti: Nessuno
P1/P2 aperti: Sincronizzazione completa LedgerRepository ancora da implementare nel task corrente.
Esito: PASS
Esito finale: PASS per la slice TLS/pairing; gate complessivo remote-mobile-host non chiuso.
