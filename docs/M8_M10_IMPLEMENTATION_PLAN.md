# Piano esecutivo M8–M10

## Baseline verificata — 2026-07-28

- Branch: `feature/m8-m10-cloud-analytics-release` da `3fd627c`.
- Node `24.15.0`, pnpm `11.9.0`.
- SQLite/OPFS e IndexedDB: schema v10.
- Backup SQLite/OPFS: AES-256-GCM, PBKDF2-HMAC-SHA-256 (600.000 iterazioni), checksum e
  verifica integrità; UI locale per backup e restore.
- Quality gate iniziale: format, lint, TypeScript, 184 test e build PWA verdi.

## Decisioni di implementazione

1. **Cloud Drive**: OAuth Google Identity Services in memoria, senza client secret né token
   persistiti; scope `drive.appdata` per evitare accesso ai file personali. Le API Drive saranno
   isolate dietro porte cloud e configurate con `VITE_GOOGLE_CLIENT_ID`.
2. **Backup**: envelope cifrato già approvato, con metadata minimi e checksum. IndexedDB usa un
   payload canonico stabile, deterministico e privo di token/cache.
3. **PWA scheduling**: le verifiche restore scadute vengono proposte all’apertura; nessuna
   promessa di background scheduling universale.
4. **Analisi**: servizi dominio deterministici, importi `bigint`, trasferimenti e annullati
   esclusi da entrate/spese; le UI consumano solo proiezioni.
5. **Release**: benchmark riproducibili, split di route e feature pesanti lazy, audit di
   sicurezza, recovery drill non distruttivo e quality gate completo.

## Sequenza

1. Fondazione OAuth/Drive e adapter simulabile.
2. Upload/download cifrato, backup IndexedDB e cronologia/restore test.
3. Trend, forecast, diario e centro notifiche.
4. Benchmark, bundle, sicurezza, recovery, accessibilità, visual regression e release.

## Vincoli esterni

Un client ID Google reale e gli Authorized JavaScript Origins devono essere configurati
dall’owner del progetto. L’app resta completamente verificabile con adapter mock senza tali
credenziali.
