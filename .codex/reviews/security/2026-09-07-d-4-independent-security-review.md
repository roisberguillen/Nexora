# 12.5.D.4 — Independent Security Review

Fase: 12.5.D.4
Data: 2026-09-07
Reviewer/fase: Codex — independent security review, CRITICAL / SECURITY
Scope: ledger locale, import/export, backup/restore, App Lock, PWA, Tauri, Local Host e supply chain
Modifiche: nessuna modifica runtime; review, test ed evidence soltanto.
Esito: PASS
Branch: `codex/phase-12-5-0-checkpoint`
Risultato: `12.5.D.4 PASS`; prossimo `12.5.D.F`

## Threat model

### Asset

Ledger e dati finanziari, database SQLite/OPFS/IndexedDB, backup `.nexora-backup`, file importati
ed esportati, preferenze, PIN/App Lock, token OAuth in memoria, operation log, configurazioni e
metadata tecnici di recovery.

### Trust boundaries

Browser e JavaScript, storage browser, OPFS/SQLite/IndexedDB, filesystem scelto dall’utente, PWA e
service worker, Tauri/WebView e plugin SQL, file esterni import/export, backup/restore, Google Drive
`appDataFolder` e Local Host/sync loopback.

### Attacker e misuse cases

File maleformato o ostile, CSV/XLSX formula injection, backup manipolato/troncato, restore di formato
futuro, path traversal, XSS, secret nei log, dipendenza vulnerabile, CSP/permission troppo ampie,
bypass App Lock, replay/duplicazione operation log e reset/cancellazione accidentale.

## Review areas

- Secrets: scansione repository e file tracciati; `.env.example` è l’unico template, nessuna
  credenziale reale, backup reale, private key o token rilevato. History recente non contiene
  pattern di private key/API key esposti; i match residui sono codice di redazione, test e documenti.
- Logs: `createSafeLogger` usa metadata allowlisted e classifica errori; non emette importi,
  transazioni, PIN, passphrase, token o payload. Le chiamate console residue sono diagnostiche
  non sensibili o validator.
- Import/export: limiti CSV (10 MiB, 100k righe, 256 colonne), preview/dry-run/commit atomico,
  stati auditabili e deduplica; CSV neutralizza `=`, `+`, `-`, `@`; XLSX usa celle statiche; export
  filtra movimenti cancellati e non include secret/configurazioni.
- Backup/restore: AES-256-GCM con header autenticato, PBKDF2-HMAC-SHA-256 600.000 iterazioni,
  salt/IV casuali, checksum, limiti 512 MiB, manifest/schema validation, integrity check, checkpoint,
  restore esplicito e rollback. Passphrase non persistita.
- App Lock: verifier PBKDF2 in localStorage, record malformato fail-closed, route/hash e reload
  protetti, reset recovery esplicito. App Lock è protezione della sessione browser e non cifratura
  del ledger a riposo; il limite è dichiarato dall’app.
- XSS/CSP: nessun `dangerouslySetInnerHTML`, `eval` o `new Function`; l’HTML statico di startup
  non incorpora input utente. CSP separa bridge OAuth, vieta object/base injection e limita script,
  connect, worker e frame alle origini necessarie; `wasm-unsafe-eval`/inline style sono vincoli
  verificati di SQLite WASM/UI e non sono stati ampliati.
- Tauri/filesystem: capability minima con core/sql e `sql:allow-execute`; database URL nativo è
  `sqlite:nexora.db` con pattern che rifiuta path arbitrari; nessun comando shell/fs/opener/http
  aggiuntivo esposto. Il permesso SQL è necessario alle migrazioni condivise e resta hardening da
  ricontrollare con eventuale capability più stretta in una fase successiva.
- Local Host/operation log: binding loopback di default, LAN solo con consenso/TLS policy, origine
  allowlist, device/token/fingerprint/scadenza, rate limit, payload 32 KiB, cursor validato,
  idempotency key e conflitti senza overwrite silenzioso. Sync futuro non è stato implementato.
- PWA/storage: service worker precache solo asset applicativi; nessun endpoint ledger in cache.
  Ledger resta in OPFS/IndexedDB/SQLite secondo backend scelto; token Google è solo in memoria e lo
  scope è `drive.appdata`.
- Supply chain/build: dipendenze pin-nate nel lockfile, script lifecycle limitati al setup hook,
  audit production senza vulnerabilità note; `cargo check` del target Tauri verde.

## Findings

| ID | Area | Severity | Evidence | Scenario | Correzione | Stato |
| --- | --- | --- | --- | --- | --- | --- |
| D4-001 | Security cross-surface | Nessuno | Review codice, negative tests, E2E, audit dipendenze e cargo check verdi | Nessun exploit concreto riprodotto su backup, import, App Lock, XSS, Local Host, Tauri o reset | Nessuna correzione runtime necessaria | CLOSED |

## Totale

- P0: 0
- P1: 0
- P2: 0

## Security tests

- `pnpm vitest run packages/database/src/backup apps/web/src/security apps/web/src/cloud apps/local-host/src packages/domain/src/services/localSyncSecurity.test.ts packages/domain/src/services/syncOperationLog.test.ts` → 16 file, 70 passed, 0 failed.
- `pnpm exec playwright test test/e2e/c3-security-app-lock.spec.ts test/e2e/c4-app-lock-settings-recovery-flow.spec.ts test/e2e/backup-restore.spec.ts test/e2e/c4-backup-restore-drive-flow.spec.ts test/e2e/c4-bank-statement-import-export-flow.spec.ts --workers=1` → 26 passed, 28 skipped, 0 failed; skip condizionati dai profili/backend, nessun failure nascosto.
- `pnpm audit --prod --audit-level=high` → No known vulnerabilities found.
- `cargo check --manifest-path apps/web/src-tauri/Cargo.toml` → Finished dev profile, 0 errori.
- Secret scan repository/file tracciati e history recente → nessun secret reale rilevato; output
  non contiene credenziali.

## Risultato

`PASS`

P0/P1/P2 aperti: `0/0/0`. La review non modifica invarianti contabili, database, persistenza,
crittografia o sync. Il prossimo task è esclusivamente `12.5.D.F — Final Phase D Gate`.
