# Nexora 0.5.0-rc.1 — Implementation report

## Ambito completato

R0–R6 della roadmap Release Candidate sono completati e pubblicati sul branch
`main` tramite merge commit `6fe2565`.

- Backup portabile cifrato, validato e ripristinato atomicamente su SQLite/OPFS e IndexedDB.
- Cronologia locale delle operazioni e recovery drill senza modifica del ledger attivo.
- Google Drive `appDataFolder` opzionale, con token solo in memoria, retry limitato e diagnostica
  priva di segreti.
- Centro notifiche locale con preferenze in minor unit, priorità, deduplica deterministica e
  fallback quando la Notifications API non è disponibile.

## Quality gate eseguiti

- `pnpm doctor`: superato (OPFS/FSA richiedono un browser reale; Drive non configurato in CI locale).
- `pnpm verify`: superato dopo la correzione lint `0f626c9`.
- `pnpm test:e2e`: 52 passati, 17 skip intenzionali per test limitati al viewport/backend previsto.
- `pnpm manifest:check`: superato.
- `pnpm audit --prod`: nessuna vulnerabilità nota.

## Limiti residui

- La RC non è una release 1.0.0: il ledger in uso nel browser non è cifrato a riposo.
- Le notifiche browser richiedono consenso esplicito e non sono garantite a PWA/browser chiusi.
- Drive è disattivato finché l'installazione non configura un client ID e le origini OAuth autorizzate.
