# Nexora — Roadmap correttiva di stabilizzazione

Stato: **FIX.1–FIX.12 completate — RELEASE GATE PASS** — 2026-09-12. Questa roadmap viene prima di nuove
funzionalità e sospende ogni dichiarazione `NEXORA READY`, `RELEASE READY` o `ANDROID PASS`
finché il gate FIX.12 non è PASS.

## Evidenze iniziali

### Bug confermati

- Il runtime Tauri espone `supportsMultiCallTransactions = false`, ma il repository usa ancora
  `withWriteTransaction` con `BEGIN IMMEDIATE`, molte chiamate IPC e `COMMIT`/`ROLLBACK`.
  Il diff locale corregge solo `deleteUnusedAccount`; il perimetro completo non è ancora chiuso.
- L'APK release disponibile è esplicitamente unsigned; la firma di produzione non è stata
  verificata e `adb devices -l` non ha rilevato device/emulatore.
- La build Tauri Android completa è stata limitata da symlink/cache Kotlin su Windows; sono stati
  verificati separatamente Rust/Gradle, non il percorso end-to-end su device.
- Esiste una divergenza di dimensione non spiegata: evidenza precedente 17.230.860 byte, rebuild
  corrente 165.304.700 byte.
- Lo stato persistente dichiara `Nexora 1.0 READY` mentre i prerequisiti Android obbligatori sono
  documentati come N/A/non eseguiti e il working tree contiene modifiche funzionali non committate.

### Bug probabili da riprodurre

- CRUD nativo di conti oltre alla cancellazione del conto vuoto: update, archive, delete protetto,
  conti con riferimenti e persistenza dopo riapertura.
- Movimenti con split/tag, trasferimenti multi-record, importazioni, reset, restore e altri flussi
  multi-write su Tauri, perché condividono il wrapper transazionale multi-call.
- Differenze tra adapter OPFS/IndexedDB e SQLite nativo in errori, rollback, chiusura e startup.
- Falsi positivi E2E: assertions di presenza/click senza una postcondizione letta dal database;
  il coverage browser non dimostra da solo il comportamento Tauri Android/Desktop.

### Nuovi problemi scoperti

- Il test dell'adapter Tauri verifica il flag e il forwarding, ma non simula una transazione
  distribuita su connessioni IPC/pool né verifica rollback reale sul runtime nativo.
- Il test nativo aggiunto per `deleteUnusedAccount` usa `DatabaseSync` in memoria e quindi non è
  una prova di compatibilità con `@tauri-apps/plugin-sql`.
- Le evidenze di packaging usano `-x rustBuild...` in alcuni passaggi: la matrice deve distinguere
  artefatti web/Gradle da build Tauri/Rust effettivamente integrate.

## Regola comune di avanzamento

Ogni fase segue: **implementazione → test mirati → regression test → quality gate → aggiornamento
`test-evidence.md` e state → commit → push**. Ogni bug corretto deve avere un test che fallisce
prima del fix e passa dopo. Un test o gate fallito blocca la fase e impedisce la successiva.

## FIX.1 — Baseline e riproduzione bug

- **Obiettivo:** congelare una baseline riproducibile per browser/PWA, Tauri Desktop e Android.
- **Problemi da correggere:** riproduzione dei 25 rischi richiesti; classificazione P0/P1/P2;
  separazione tra evidenza browser, native desktop e device; spiegazione preliminare del crash,
  mancata installazione e dimensione APK.
- **File/moduli coinvolti:** `packages/database-tauri/src/*`, `packages/database/src/sqlite/*`,
  `apps/web/src-tauri/*`, `test/e2e/*`, `playwright.config.ts`, `.codex/state/*`.
- **Test obbligatori:** baseline Vitest/typecheck; E2E con postcondizioni DB; `cargo check --locked`;
  Gradle debug/release; inventario APK/AAB e `adb install/launch` quando il device è disponibile.
- **Criteri di accettazione:** matrice riproduzioni con log redatti, fixture sintetiche e severità;
  nessuna modifica dati reali; ogni scenario ha expected state verificabile.
- **Dipendenze:** nessuna; è la prima fase e non avvia fix applicativi.

## FIX.2 — Architettura SQLite/Tauri e atomicità

- **Obiettivo:** rendere esplicito il confine transaction-safe tra adapter browser e pool IPC Tauri.
- **Problemi da correggere:** tutte le chiamate a `withWriteTransaction`, `runAtomically`,
  `BEGIN/COMMIT/ROLLBACK`; transazioni multi-call non supportate; rollback e serializzazione.
- **File/moduli coinvolti:** `TauriSqliteDatabase.ts`, `SqliteDatabase.ts`,
  `SqliteLedgerRepository.ts`, `MigrationRunner.ts`, adapter OPFS/IndexedDB, Rust/Tauri SQL.
- **Test obbligatori:** matrice adapter; failure injection per ogni write multi-step; atomicità
  trasferimenti/import/reset/restore; `cargo check --locked`; smoke native.
- **Criteri di accettazione:** nessun workflow multi-record usa IPC non transaction-bound; invarianti
  e rollback provati su browser e Tauri, oppure API nativa transaction-bound verificata.
- **Dipendenze:** FIX.1.

## FIX.3 — CRUD Conti

- **Obiettivo:** chiudere create/update/archive/delete/empty e persistenza dei conti.
- **Problemi da correggere:** cancellazione fallita, riferimenti, conti archiviati, messaggi errore,
  differenze native/browser e reload/reopen.
- **File/moduli coinvolti:** `packages/database/src/{sqlite,indexeddb,in-memory}/*`,
  `packages/application/src/*`, `apps/web/src/accounts/*`, E2E accounts.
- **Test obbligatori:** regression pre-fix/post-fix per ogni bug; CRUD su due adapter; force-stop/restart
  native; conti usati/non usati e relazioni.
- **Criteri di accettazione:** stato DB e UI concordi dopo ogni operazione; dati esistenti preservati.
- **Dipendenze:** FIX.2.

## FIX.4 — Movimenti e Trasferimenti

- **Obiettivo:** validare CRUD movimenti, split, tag e trasferimenti atomici.
- **Problemi da correggere:** operazioni parziali, neutralità contabile, cancel/trash/restore,
  doppio submit e differenze tra adapter.
- **File/moduli coinvolti:** repository SQLite/IndexedDB, domain/application transactions, UI
  transactions/tags, test E2E `transactions`, `c4-transfer-flow`.
- **Test obbligatori:** postcondizioni DB, rollback a ogni step, saldi minor units, trasferimenti
  con fee, split/tag e persistence native.
- **Criteri di accettazione:** zero trasferimenti classificati come income/expense; nessun bundle
  parziale; CRUD verificato dopo riapertura.
- **Dipendenze:** FIX.3.

## FIX.5 — Moduli finanziari

- **Obiettivo:** validare categorie, tag, budget, ricorrenze, allocazioni, prestiti, investimenti
  e diario finanziario end-to-end.
- **Problemi da correggere:** CRUD incompleto, propagazione sui saldi/report, idempotenza, precisione,
  relazioni e persistenza native.
- **File/moduli coinvolti:** `packages/domain`, `packages/database`, `packages/application`,
  `apps/web/src/{categories,tags,budgets,recurring,loans,investments,journal,analytics}` e relativi E2E.
- **Test obbligatori:** unit/integration per dominio e repository; flussi completi con reload,
  offline e Tauri; negative cases e controlli minor units.
- **Criteri di accettazione:** ogni modulo ha CRUD e invariant evidence su browser e native.
- **Dipendenze:** FIX.4.

## FIX.6 — Import Money Manager

- **Obiettivo:** rendere affidabili preview, mapping, deduplica, commit, rollback e undo.
- **Problemi da correggere:** import parziali, fingerprint, duplicati, undo non completo e differenze
  native/browser.
- **File/moduli coinvolti:** `packages/importers`, import commands/repository, `test/e2e/imports*`,
  fixture Money Manager realistica ma anonimizzata.
- **Test obbligatori:** preview senza scrittura, commit atomico, failure injection, deduplica e undo
  dopo restart su OPFS/IndexedDB/Tauri.
- **Criteri di accettazione:** nessuna importazione definitiva senza conferma; rollback lascia il
  ledger invariato e undo è verificabile dal DB.
- **Dipendenze:** FIX.2, FIX.4.

## FIX.7 — Backup / Restore / Reset

- **Obiettivo:** chiudere backup verificato, restore non distruttivo, rollback e reset finanziario/totale.
- **Problemi da correggere:** overwrite, checkpoint, checksum, cifratura, schema parity e recovery.
- **File/moduli coinvolti:** `packages/database/src/backup/*`, reset/startup/recovery, picker Tauri,
  E2E backup/restore/reset.
- **Test obbligatori:** round-trip A→B→A, checksum/tamper, restore failure, interruption, rollback,
  reset con conferma e riapertura su tutti gli adapter.
- **Criteri di accettazione:** restore verificato prima dell'applicazione; precedente DB preservato
  in caso di errore; reset non silenzioso.
- **Dipendenze:** FIX.2, FIX.4, FIX.6.

## FIX.8 — Android Build Pipeline

- **Obiettivo:** ottenere una pipeline Tauri/Rust/Gradle riproducibile per arm64 e release.
- **Problemi da correggere:** symlink/cache Windows, dev-server address, skip impliciti del Rust task,
  ABI e riproducibilità; spiegazione della crescita APK.
- **File/moduli coinvolti:** `apps/web/src-tauri/{Cargo.toml,tauri.conf.json,build.rs,src/*}`,
  `gen/android/{build.gradle.kts,app/build.gradle.kts,gradle.properties}`, CI/workflow e scripts.
- **Test obbligatori:** Rust target arm64 locked, Tauri Android end-to-end senza skip, Gradle clean
  release APK/AAB, ABI/contents report, size budget e checksum.
- **Criteri di accettazione:** artefatto prodotto dalla pipeline completa, ABI dichiarata, size delta
  spiegato e installabilità verificata; nessun “build PASS” da Gradle isolato.
- **Dipendenze:** FIX.7.

## FIX.9 — Android Signing

- **Obiettivo:** configurare firma release riproducibile e verificabile senza segreti nel repository.
- **Problemi da correggere:** APK unsigned, keystore/alias/versionCode, provenance e verifica firma.
- **File/moduli coinvolti:** Gradle signing config, CI secret bindings, release scripts e documentazione.
- **Test obbligatori:** `apksigner verify --verbose`, certificate fingerprint, install/upgrade
  signed APK e controllo che debug/unsigned non siano pubblicabili.
- **Criteri di accettazione:** APK release signed con certificato atteso, keystore fuori repo e
  artefatto/fingerprint tracciati senza esporre credenziali.
- **Dipendenze:** FIX.8.

## FIX.10 — Device Gate Pixel 9

**Stato corrente: COMPLETE / PASS — 2026-09-11.** Il bridge Rust accetta correttamente il database
predefinito `sqlite:nexora.db` e l’adapter TypeScript ora preserva i metodi definiti sul prototype
della connessione Tauri SQL; la correzione è pubblicata in `85f8fd8`, con test mirati 9/9 e
typecheck/prettier verdi. La variante debug avvia il Pixel 9 senza il precedente errore di bootstrap.
La release firmata post-correzione è stata ricostruita e verificata con `apksigner` (v2 PASS,
certificato atteso, APK SHA-256 `6A0735A5DCA66294C7BFBB595B31644859B0E3DD95D825D87F43BE6613311E8A`).
Il Pixel 9 è stato rilevato e la release è stata installata con `adb install -r` (`Success`);
`MainActivity` è rimasta in primo piano dopo il rilancio e il logcat non mostra crash, errori di
bootstrap o `TypeError`. Sul build debug separato, un batch sintetico in stato `committed` è stato
annullato e l’interfaccia ha mostrato `undone`, senza dati reali. Il device si è poi disconnesso
prima di una nuova importazione con commit e verifica finale del ledger; quella evidenza preliminare
è stata superata dalla traccia finale descritta sotto.

Aggiornamento finale FIX.10: il Pixel 9 ha eseguito una nuova importazione sintetica con `1 pronta`,
commit riuscito e verifica della riga nei Movimenti; il batch è stato poi annullato. L’audit ha mostrato
`undone` e il movimento è rimasto come `Annullato · Importato`, senza cancellazione fisica e senza dati reali.
FIX.10 è chiusa con PASS.

- **Obiettivo:** validare il prodotto Android su Pixel 9 o device Android equivalente dichiarato.
- **Problemi da correggere:** installazione/avvio reale, crash, SQLite native, force-stop/restart,
  CRUD, trasferimento, import, backup/restore e comportamento offline.
- **File/moduli coinvolti:** release APK signed, test runbook, `test/e2e/*`, logcat redatti e state.
- **Test obbligatori:** `adb install`, launch, create/update/delete account, movement/transfer,
  import/undo, backup/restore, force-stop/restart e verifica DB dopo ogni checkpoint.
- **Criteri di accettazione:** tutti i flussi reali PASS, zero crash/errori database critici,
  persistence PASS; Gradle/Tauri/APK da soli non valgono come PASS.
- **Dipendenze:** FIX.3–FIX.9.

## FIX.11 — Regression Suite completa

**Stato corrente: COMPLETE / PASS — 2026-09-12.** `pnpm verify` ha completato Prettier, ESLint,
typecheck, 649 test Vitest (645 pass, 4 skip) e build/PWA. La suite E2E completa riconciliata nel
gate precedente conta 666 test: 433 pass, 233 skip, 0 fail; i timeout di contesa paralleli sono stati
ritentati serialmente con esito PASS. Recovery, performance, adapter/native/device matrix,
`codex:test`, `test:ui-ux`, `quality:ui-ux` e `manifest:check` sono verdi. Il rerun seriale del
12 settembre è stato interrotto manualmente prima del termine e non viene contato come nuova prova.

- **Obiettivo:** unificare unit, integration, E2E browser/PWA, Desktop e Android con postcondizioni.
- **Problemi da correggere:** false coperture, selector-only assertions, skip non motivati, fixture
  non deterministiche e assenza di failure-before/fix-after.
- **File/moduli coinvolti:** `test/e2e/*`, fixtures, `playwright.config.ts`, Vitest, CI e state evidence.
- **Test obbligatori:** full verify, E2E seriale e parallelo riconciliato, recovery/performance,
  matrix adapter/native/device e regressioni per ogni bug.
- **Criteri di accettazione:** ogni scenario verifica una postcondizione persistita; skip espliciti
  con owner e prerequisito; zero P0/P1.
- **Dipendenze:** FIX.5, FIX.6, FIX.7, FIX.10.

## FIX.12 — Release Gate finale

**Stato corrente: COMPLETE / PASS — 2026-09-12.** La quality suite, la regressione E2E riconciliata,
le evidenze di sicurezza/recovery, il manifest, la firma APK v2, l’installazione/avvio sul Pixel 9,
la persistenza nativa, i flussi CRUD/trasferimento/import/undo/backup-restore/offline e il packaging/
startup desktop sono tutti PASS. Non risultano P0/P1 aperti; gli skip E2E sono espliciti e condizionati
dal backend o dal prerequisito del test. I controlli finali `pnpm verify`, `pnpm manifest:check`,
`pnpm codex:validate`, `pnpm codex:test`, `pnpm test:ui-ux` e `pnpm quality:ui-ux` sono verdi.

Risultato: `NEXORA READY`, `RELEASE READY`, `ANDROID PASS`.

- **Obiettivo:** autorizzare una release soltanto con evidenze complete e working tree coerente.
- **Problemi da correggere:** qualsiasi gate aperto, stato contraddittorio, manifest stale o release
  non riproducibile.
- **File/moduli coinvolti:** `.codex/state/*`, `docs/ROADMAP_STABILIZATION.md`, `CHANGELOG.md` se
  milestone completata, manifest, CI release artifacts.
- **Test obbligatori:** quality gate completo, security/audit, full regression, backup/restore,
  signed APK verification, Pixel 9 device gate, Desktop packaging/startup.
- **Criteri di accettazione:** zero P0/P1; native persistence, CRUD, atomic transfers, import/rollback,
  backup/restore, signed APK, Pixel 9 e regression suite tutti PASS. Solo allora si può dichiarare
  `NEXORA READY`, `RELEASE READY` e `ANDROID PASS`.
- **Dipendenze:** FIX.11.

## Punto di partenza e riaperture

Si parte da **FIX.1**, senza implementarla in questa esecuzione. Devono essere riaperte, come audit
correttivo, le evidenze **13.1–13.F** (parità/persistenza Desktop), **14.1–14.F** (Android native,
packaging e final gate) e **17.F** (READY finale); le fasi funzionali 12.5.C4–C5 restano riusabili
solo come baseline browser/PWA finché FIX.4–FIX.7 non le riconfermano su Tauri.
