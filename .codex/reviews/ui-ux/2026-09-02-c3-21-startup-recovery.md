# NEXORA — Fase 12.5.C3.21

Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Startup + Recovery
Route: `bootstrap` (prima della shell)
Flusso principale: bootstrap → loading → READY oppure recovery guidato → archivio esplicito
Reviewer/fase: Codex — 12.5.C3.21
Modifiche: token visivi startup/recovery, CTA condivise e layout responsive fail-safe.
Data: 2026-09-02
Esito: PASS

## Contratto reale

Lo startup orchestrator esegue environment check, discovery, apertura, validazione, migrazione e
verifica dati prima di esporre la shell. La shell non viene montata durante loading o recovery e
nessun archivio viene sostituito o resettato automaticamente. Un ledger aperto viene chiuso se
una fase successiva fallisce; OPFS può ricadere su IndexedDB solo quando la discovery ha dimostrato
che OPFS era assente.

In presenza di più archivi locali presenti, Nexora richiede una scelta esplicita. La recovery offre
retry, apertura di una copia rilevata, diagnostica e verifica non distruttiva di un backup cifrato.
Il ripristino temporaneo usa un IndexedDB isolato e lo rimuove sempre; l’archivio attivo non viene
modificato. Il lock applicativo resta fail-closed prima della shell e il recupero totale resta
protetto da conferma esplicita.

## Viewport ed evidence

- 320 / 375 / 390 px: loading e shell READY senza overflow; recovery con azioni a larghezza piena.
- 768 px: layout tablet leggibile e azioni reflow-safe.
- 1024 / 1440 px: card startup coerenti con i pannelli Nexora e con la gerarchia Stitch.
- Zoom 200%: componenti e target CTA restano utilizzabili; il layout usa dimensioni fluide e
  larghezza interna limitata.
- Tema scuro, testo grande e riduzione animazioni: startup/recovery usano gli stessi token globali
  e rispettano `data-theme`, `data-text-scale` e `data-reduce-motion`.
- Browser/Playwright: `startup.spec.ts` 6 viewport, `startup-orchestrator.spec.ts` policy,
  `startup-multitab.spec.ts` concorrenza Chromium 1440; 7 pass e 5 skip condizionati.

## Mobile-first gate

| Area | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | stati loading/ready/recovery separati | PASS | `App.tsx`, orchestrator e test UI |
| Mobile | padding, reflow, CTA e overflow | PASS | 320/375/390 px e CSS responsive |
| Desktop | densità e gerarchia | PASS | 1024/1440 px |
| Tablet | layout intermedio leggibile | PASS | 768 px e breakpoint responsive |
| Visuale | coerenza Nexora/Stitch e temi | PASS | token globali, dark mode e text scale |
| Ricerca | superficie startup senza ricerca propria | N/A | La ricerca appartiene alla shell e non viene montata prima di READY. |
| Form | file backup, passphrase e CTA | PASS | recovery screen e test componenti |
| Feedback | loading, errore, busy e risultato | PASS | status/alert e messaggi non distruttivi |
| Accessibilità | status/alert, labels, focus e target | PASS | test componenti + E2E |
| Recovery | scelta esplicita e nessun fallback silenzioso | PASS | discovery/selection/orchestrator |
| Sicurezza | no data flash, close on failure, no auto-reset | PASS | test startup, lock e recovery |
| Finanza | ledger attivo invariato durante recovery | PASS | verifica backup e restore isolato |
| Offline | apertura locale e reload | PASS | `startup.spec.ts` |
| Performance | timeout e startup multi-tab | PASS | orchestrator e multi-tab E2E |

## Rilievi

### P0

P0 aperti: Nessuno

### P1

Nessuno.

### P2

Nessuno.

## Correzioni e test

- `apps/web/src/startup/startup.css`: startup/loading/recovery allineati ai token di tema, radius,
  colori e pulsanti Nexora; padding e larghezza fluida per 320 px; guidance e campi coerenti;
  rispetto della riduzione animazioni globale.
- `apps/web/src/startup/StartupRecoveryScreen.tsx`: azioni recovery allineate ai pulsanti condivisi
  `primary-action` / `secondary-action`.
- `apps/web/src/startup/StartupRecoveryScreen.test.tsx`: regressione sui ruoli visuali delle CTA.
- Test mirati startup/recovery/migrazione/security/persistence: 71 pass.
- Suite completa: 140 file passati, 618 test passati, 4 skip documentati.
- `pnpm verify`, `pnpm test:ui-ux`, `pnpm quality:ui-ux`, startup E2E e build: PASS.

## Conclusione

`SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Startup + Recovery sono `FROZEN` per C3.

`UI_REVIEW_PASS`
