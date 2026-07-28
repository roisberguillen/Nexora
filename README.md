# Nexora

Nexora è una Progressive Web App offline-first per la gestione completa della finanza personale: conti, N26 Spaces, entrate, spese, trasferimenti, budget, prestiti, investimenti, obiettivi, importazioni, backup e analisi.

## Stato del repository

Le **Milestone 0, 1 e 2 sono completate**. La Milestone 3 è in corso: il repository
contiene PWA installabile, persistenza offline SQLite/OPFS con fallback IndexedDB,
dashboard, gestione conti e primi flussi Movimenti (entrate, spese, rettifiche,
trasferimenti atomici e annullamento conservativo).

I prossimi flussi della Milestone 3 sono split persistenti, categorie/tag e ricerca,
descritti in `docs/ROADMAP.md`.

## Sviluppo locale

Prerequisiti: Node 24 e pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Quality gate completo:

```sh
pnpm verify
pnpm test:e2e
pnpm manifest:check
```

## Workspace

- `apps/web`: PWA e composizione dell’applicazione;
- `packages/ui`: componenti accessibili e token semantici;
- `packages/config`: impostazioni condivise e logging sicuro;
- `packages/domain`: value object, entità e invarianti contabili;
- `packages/database`: repository in-memory; persistenza offline dalla Milestone 2;
- `packages/importers`: pipeline di importazione, dalla Milestone 4.

## Principi non negoziabili

- offline-first;
- dati finanziari locali e privati;
- importazioni reversibili e idempotenti;
- trasferimenti esclusi da entrate e spese;
- importazione Money Manager XLSX prioritaria;
- calcoli monetari senza floating point binario;
- backup verificabili;
- nessuna feature implementata senza specifica e criteri di accettazione.

## Mockup UX/UI

Il mockup ufficiale è incluso in `design/mockup/stitch/`. Per trasformarlo in componenti applicativi usare il prompt `.codex/prompts/03-ui-from-mockup.md`.
