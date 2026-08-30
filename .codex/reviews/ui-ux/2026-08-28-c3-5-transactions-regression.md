# 12.5.C3.5 — Transactions regression Mobile/Desktop audit

Framework: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`  
Fase: `12.5.C3.5`  
Superficie: Transactions regression / Movimenti  
Route: `#transactions` / `#new-transaction`  
Data: 2026-08-28  
Revisore: Codex — UI/QA review  
Baseline: `12.5.C2.9 TRANSACTIONS_GATE_PASS`  
Esito: `SCREEN_AUDIT_PASS`

## Viewport ed evidence

- Mobile: 320, 375, 390 px — E2E Movimenti PASS; Chrome ha verificato la route popolata e,
  nel fix mobile, editor full-width, lista nascosta e `Conto` visibile.
- Tablet: 768 px — E2E PASS.
- Desktop: 1024 e 1440 px — E2E PASS.
- Zoom browser 200% — baseline C2.7-F1 PASS e preservata; la nuova chiusura dedicata non è
  approvabile finché i gate globali restano rossi.
- Browser: Chrome reale su `http://127.0.0.1:5173/#transactions`; Playwright Chromium sui sei
  progetti. Dataset demo, lista, filtri e form sono stati caricati; nessun reset o modifica dati
  dell’utente è stato eseguito.

## Verifiche

| Area | Risultato | Evidence |
| --- | --- | --- |
| Funzionalità e CTA | PASS | `transactions.spec.ts`, 66/66; lista, ricerca, filtri, form, Entrata/Uscita, transfer e cestino |
| Mobile | PASS | 320/375/390 E2E PASS; editor mobile verificato in Chrome |
| Desktop | PASS | E2E 1024/1440 PASS |
| Responsive | PASS | Sei progetti Chromium, nessun failure Movimenti |
| Stati UI | PASS | empty/filtered/error/disabled coperti |
| Accessibilità | PASS | axe e dialog/keyboard nei flussi E2E Movimenti |
| Edge case | PASS | split, trasferimenti read-only, annullamento, doppio submit e testi lunghi coperti dalla baseline |
| Coerenza Nexora/Stitch | PASS | nessun redesign; correzione mobile limitata alla regressione dimostrata |

## Cross-screen

App Shell, Global Search, Dashboard e Accounts conservano le loro review C3 PASS; i percorsi
verso Movimenti sono coperti dalle suite di integrazione esistenti e non hanno mostrato failure.

## Rilievi

### P0

Nessuno.

### P1

Nessuno.

### P2

Nessuno registrato: Movimenti resta congelata.

## Correzioni e test

- Correzioni applicative C3.5 già pubblicate nel commit `96aa506` per l’editor standalone mobile;
  nessuna nuova correzione è stata applicata durante questa review.
- `pnpm exec playwright test test/e2e/transactions.spec.ts --reporter=line`: `66/66 PASS`.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm codex:validate` e
  `pnpm quality:ui-ux`: PASS.
- `pnpm test`: `137 passed`, `1 skipped`, `589 passed`, `4 skipped` dopo l’allineamento del
  fixture cestino in `SettingsPage.test.tsx`.
- `pnpm manifest:check`: PASS sul worktree corrente; manifest aggiornato in modo isolato per lo
  snapshot committato, senza includere modifiche applicative estranee.

## Conclusione

Movimenti non presenta regressioni P0/P1. Tutti i gate applicabili e l’evidence browser richiesta
sono verdi: `SCREEN_AUDIT_PASS`. Movimenti resta congelata e il prossimo task è C3.6 Budget.
