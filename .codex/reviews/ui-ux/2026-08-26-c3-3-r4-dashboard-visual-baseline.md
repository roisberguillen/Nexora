# 12.5.C3.3-R4 — Dashboard Visual Baseline & Evidence Closure

- Manifest/checklist: Nexora UI audit, Dashboard/Home, evidence closure
- Schermata: Dashboard / Home
- Route: `#overview`
- Task/Fase: `12.5.C3.3-R4` / Phase 12.5
- Branch: `codex/phase-12-5-0-checkpoint`
- Data: `2026-08-26`
- Revisore: Codex
- Flow: apertura Dashboard, stato vuoto, dati dimostrativi, responsive e zoom
- Viewport: `320`, `375`, `390`, `768`, `1024`, `1440` px; zoom `200%`

## Code review — PASS

- L’unico H1 della Dashboard è visibile come `Panoramica finanziaria` e il suo accessible name coincide con il testo renderizzato.
- Rimossa l’ARIA ridondante che esponeva il precedente nome `Il tuo quadro finanziario`.
- Le metriche finanziarie e le regole R3 restano invariate: cash flow mensile, esclusione di trasferimenti/cancellati, saving rate, stato e overlap dei budget, prossime uscite, categorie, trend, multi-valuta/account count e baseline del grafico a zero.
- Cash forecast esplicito: `DEFERRED`, fuori scope R4.

## Automated browser verification — PASS

- `test/e2e/dashboard.spec.ts` su Chromium 1440: baseline obsoleta rilevata prima dell’update; dopo l’aggiornamento, riesecuzione senza update `2/2 PASS`.
- `test/e2e/c3-dashboard-audit.spec.ts`: matrice Dashboard `8 passed`, `4 skipped` previsti per il caso mobile zoom.
- La suite completa precedente R3 resta `589 passed`, `4 skipped`; i test H1 sono stati riallineati al nuovo accessible name.
- Nessuna baseline diversa da `dashboard-1440-chromium-1440-win32.png` è stata aggiornata.

## Visual browser verification — PASS

- Route reale `http://127.0.0.1:5173/#overview` verificata in Chrome.
- Superficie verificata: header compatto, badge stato, KPI, stato budget vuoto, upcoming, trend con baseline neutra, categorie, attività recenti e conti.
- Verificata l’assenza di overflow orizzontale; il controllo Chrome mostra `scrollWidth === clientWidth`.
- Lo screenshot generato prima dell’update è stato ispezionato visivamente e riconosciuto come la UI R3 corrente; il solo aggiornamento applicato è la baseline Windows 1440.

## Baseline closure

1. Test visuale senza update: FAIL atteso per mismatch della baseline precedente (`1440x1976` atteso, `1440x1983` ricevuto).
2. Screenshot actual ispezionato visivamente.
3. Update limitato a `test/e2e/dashboard.spec.ts-snapshots/dashboard-1440-chromium-1440-win32.png`.
4. Test visuale senza update rieseguito: `2/2 PASS`.

## Final disposition

- Severity: `P0=0`, `P1=0`, `P2=0`.
- Esito: `SCREEN_AUDIT_PASS`.
- `Dashboard/Home — FROZEN` per C3.
