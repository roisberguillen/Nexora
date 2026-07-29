# Nexora

Nexora è una PWA offline-first per finanze personali. I dati restano nel browser: SQLite WASM
su OPFS è il backend preferito; IndexedDB è il fallback esplicito quando OPFS non è disponibile.

## Stato prodotto

Versione corrente: **0.5.0-rc.1**. Non è una release di produzione. La roadmap Release
Candidate in `docs/ROADMAP.md` distingue in modo verificabile funzionalità completate, limiti e
lavoro ancora necessario prima di una RC.

## Requisiti

- Node.js `>=24.14.0 <25` (versione consigliata: 24.15.0);
- pnpm `>=11.9.0 <12`;
- Chromium/Chrome recente per OPFS e File System Access API. Altri browser possono usare
  IndexedDB, con un formato di backup logico cifrato equivalente a SQLite/OPFS.

## Installazione

Su Windows, macOS e Linux:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm doctor
pnpm dev
```

Apri l’URL mostrato da Vite. `pnpm doctor` non mostra mai valori di variabili o credenziali;
segnala soltanto presenza e compatibilità dell’ambiente.

## Comandi

```sh
pnpm dev
pnpm doctor
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm manifest:check
pnpm test:e2e
pnpm audit --prod
```

`pnpm verify` esegue format, lint, typecheck, test e build. Gli E2E richiedono Chromium.

Il benchmark di hardening viene eseguito intenzionalmente a parte, perché materializza ledger
sintetici fino a 100.000 movimenti:

```powershell
$env:NEXORA_HARDENING_BENCHMARK = '1'
pnpm exec vitest run test/benchmarks/hardeningBenchmark.test.ts --reporter=verbose
Remove-Item Env:NEXORA_HARDENING_BENCHMARK
```

Misura selezione, cestino, ripristino, purge, ricostruzione categorie, snapshot/restore e reset
senza usare dati personali. I risultati verificati della release sono nel report finale.

## Google Drive

Google Drive è facoltativo. L’app usa il solo scope `drive.appdata`: token OAuth in memoria e
archivi cifrati prima dell’upload. Non inserire mai un client secret nel repository.

```env
VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
VITE_GOOGLE_DRIVE_ENABLED=true
```

Configura gli Authorized JavaScript Origins per l’origine locale e quella di produzione. Senza
queste variabili la UI comunica correttamente che Drive non è configurato e il backup locale resta
disponibile dove supportato dal browser.

## Struttura

- `apps/web`: PWA React/Vite;
- `packages/domain`: entità, value object e invarianti contabili;
- `packages/database`: repository, migrazioni, SQLite/OPFS e IndexedDB;
- `packages/ui`: componenti accessibili e token CSS;
- `packages/importers`: importatori locali;
- `docs`: architettura, ADR, sicurezza, roadmap e procedure operative.

## Limiti noti

- il ledger aperto nel browser non è cifrato a riposo dal solo browser; i backup cifrati usano una
  passphrase temporanea;
- le operazioni in background non sono garantite quando PWA/browser sono chiusi;
- nessun client OAuth o dato finanziario reale è incluso nel repository.
