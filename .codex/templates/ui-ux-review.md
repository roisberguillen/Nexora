# UI/UX change review

Manifest: nexora-ui-ux-mobile-desktop/v1
Data: YYYY-MM-DD
Schermata: descrivere la superficie modificata
Route: /percorso-o-non-applicabile
Flusso principale: descrivere il flusso verificato
Reviewer/fase: nome o Codex — milestone/fase
Modifiche: sintesi delle modifiche e del loro impatto

Usare questo modello per ogni modifica a una superficie UI. Per ciascuna voce,
scrivere `PASS` oppure `N/A` e motivare in modo concreto le non applicabilità.
Una criticità P0 aperta blocca il rilascio e il commit.

## Verifiche

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS/N/A | Gerarchia, azioni, navigazione, feedback e assenza di overflow verificati. |
| Mobile | M-01 | PASS/N/A | Viewport 320/360/375 px, touch target e navigazione a una mano verificati. |
| Desktop | D-01 | PASS/N/A | Layout da 1280 px, confronto dati e alternative alle sole interazioni hover verificati. |
| Tablet | T-01 | PASS/N/A | Orientamenti, navigazione e pannelli verificati. |
| Visuale | V-01 | PASS/N/A | Tipografia, colori, spaziature, stati e movimento verificati. |
| Ricerca | R-01 | PASS/N/A | Ricerca, filtri, stati e tastiera verificati oppure non applicabili. |
| Form | F-01 | PASS/N/A | Etichette, validazione, errori, dati e conferme verificati oppure non applicabili. |
| Feedback | FB-01 | PASS/N/A | Loading, errori, undo, azioni distruttive, offline e conflitti verificati. |
| Accessibilità | A-01 | PASS/N/A | Semantica, tastiera, focus, contrasto, zoom, screen reader e reduced motion verificati. |
| Finanza | FN-01 | PASS/N/A | Importi, segni, trasferimenti, sicurezza, locale e stati saldo verificati oppure non applicabili. |
| Performance | P-01 | PASS/N/A | Rendering, risorse, rete lenta/offline e recupero dagli errori verificati. |

## Criticità e decisione

P0 aperti: Nessuno
P1/P2 aperti: Nessuno oppure descrivere proprietario e scadenza
Esito: PASS
