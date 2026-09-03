# NEXORA — Fase 12.5.C4.2-R — Ripristino gate E2E zoom

Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`
Data: 2026-09-03
Schermata: C4.1 primo avvio, profilo, primo conto, persistenza e riapertura
Route: `bootstrap` → `#profile` → `#accounts` → `#overview` → `#transactions`
Flusso principale: zoom reale 200% → navigazione visibile → percorso C4.1 → axe/overflow
Reviewer/fase: Codex — 12.5.C4.2-R
Modifiche: corretto soltanto l’helper E2E `navigateToSurface()`; nessuna modifica alla UI.
Esito: PASS

## Evidenza

- Riproduzione iniziale: `2 failed`, sui progetti `chromium-1024` e `chromium-1440`, con timeout
  sul locator `Navigazione principale → Profilo`; lo snapshot mostrava `Navigazione mobile` visibile.
- Causa: `page.viewportSize()?.width` restava 1024/1440, mentre `Emulation.setDeviceMetricsOverride`
  rendeva il layout CSS rispettivamente 512/720 px. L’helper sceglieva quindi la sidebar nascosta.
- Correzione: `test/e2e/c4-first-start-account-flow.spec.ts` rileva la visibilità reale dei landmark
  accessibili `Navigazione mobile` e `Navigazione principale`, usa le etichette coerenti e fallisce
  chiaramente se nessuno dei due è visibile. Lo zoom CDP reale e i selettori a ruolo sono preservati.
- Prima/dopo: zoom dedicato `0 passed / 2 failed` → `2 passed / 0 failed`; file C4.1 `20 passed`,
  `4 skipped`, `0 failed`; C4.2 `8 passed`, `10 skipped`, `0 failed`.
- Full E2E: storico iniziale `376 passed`, `156 skipped`, `2 failed`; finale `378 passed`,
  `156 skipped`, `0 failed` su 534 casi, inclusi gli smoke OPFS/IndexedDB 100k.
- Quality: `pnpm test:ui-ux` 4 passed; `pnpm quality:ui-ux` PASS; `pnpm verify` 620 passed,
  4 skipped, format/lint/typecheck/build PASS; console, axe e overflow restano verdi nei flussi.

## Checklist UI/UX

| Area | Superficie | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Landmark navigation | PASS | Decisione basata sulla visibilità reale. |
| Mobile | Bottom navigation | PASS | Home, Conti, Movimenti e Profilo attraversati. |
| Desktop | Sidebar | PASS | Panoramica, Conti, Movimenti e Profilo attraversati. |
| Tablet | Breakpoint | PASS | C4.1 completo sui sei progetti. |
| Visuale | Zoom 200% | PASS | CDP reale preservato su 1024/1440. |
| Ricerca | Navigazione | N/A | Non parte della correzione harness. |
| Form | C4.1 | PASS | File dedicato completo verde. |
| Feedback | Errori test | PASS | Errore esplicito se nessun landmark è visibile. |
| Accessibilità | Ruoli e axe | PASS | Locator accessibili e axe invariato. |
| Finanza | Ledger | PASS | C4.2 invariato e verde. |
| Performance | Full suite | PASS | Full E2E senza failure. |

## Rilievi

### P0

P0 aperti: Nessuno

### P1

P1 risolti: selezione errata della navigazione dopo zoom CDP.
P1 aperti: Nessuno.

### P2

P2 aperti: Nessuno.

## Conclusione

`FLOW_AUDIT_PASS`; C4.1 e C4.2 restano `COMPLETE`, C4.3 è `NEXT`. Nessuna superficie UI, dominio,
database, migrazione o copertura zoom è stata ridotta.
