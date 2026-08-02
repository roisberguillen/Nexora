# Roadmap UI, architettura e multipiattaforma

Fonte: `NEXORA_ROADMAP_UI_ARCHITETTURA.md`, ricevuta il 31 luglio 2026. Questa roadmap sostituisce
le roadmap di evoluzione precedenti per le attività di UI, piattaforma, backup e sincronizzazione;
le invarianti finanziarie e le migrazioni già verificate restano vincolanti.

| Fase | Obiettivo | Stato |
|---|---|---|
| 0 | Congelamento delle specifiche | completata |
| 1 | Audit e mappatura del mockup | completata |
| 2 | Rimozione NAS e funzioni eliminate | completata |
| 3 | Fondamenta applicative | completata |
| 4 | Design system e App Shell | completata |
| 5 | Startup e stati trasversali | completata |
| 6 | Modulo pilota conti/movimenti/dashboard | completata |
| 7 | SQLite nativo multipiattaforma | completata |
| 8 | Importazione, esportazione e qualità dati | completata |
| 9 | Backup Engine indipendente | completata |
| 10 | Backup manuale | completata |
| 11 | Google Drive | implementata; collaudo OAuth live pendente |
| 12 | Feature finanziarie con nuova UI | pianificata |
| 13 | Applicazione Windows e macOS | pianificata |
| 14 | Applicazione Android | pianificata |
| 15 | Nexora Local Hub | pianificata |
| 16 | Sincronizzazione offline-first | pianificata |
| 17 | Hardening finale | pianificata |

Ogni fase si chiude solo con test proporzionati, aggiornamento documentale, commit Conventional
Commit e push su `origin/main`.

## Gate permanente di orchestrazione

- [x] Nexora Task Orchestrator integrato e validato prima di avviare la Fase 8.
- [x] Ogni task successivo classificato con profilo, limiti, test ed escalation persistenti.
- [x] Stato, decisioni, errori e test riusati senza scansioni complete ripetute.

## Evidenze Fase 0

- [x] Archivio Stitch registrato tramite checksum e inventario 98 schermate/prototipi.
- [x] Palette, font e invarianti Nexora confermati come precedenti alla specifica visuale.
- [x] Policy backup fissata: file `.nexora` e Google Drive; nessun percorso NAS/SMB.
- [x] Target Tauri 2, SQLite nativo e Local Hub Rust fissati negli ADR 0017–0019.
- [x] Inventario funzionale, matrice piattaforme, strategia test, specifiche backup/sync e design
  congelati.

## Evidenze Fase 1

- [x] Verificati 98 screenshot e 98 prototipi Stitch contro l'hash ufficiale.
- [x] Pubblicata la matrice schermata → route → letture → scritture → componenti → fase.
- [x] Consolidati gli stati Stitch in superfici funzionali: nessuna route fittizia o duplicata.
- [x] Definiti i confini Shell, primitivi UI, form/overlay, feedback e feature.
- [x] Registrata la sequenza di refactoring: Shell (4), startup (5), conti/movimenti/dashboard
  (6), import/export (8), backup (9–11), restante dominio (12).

## Evidenze Fase 2

- [x] Rimosso il percorso UI/API di selezione directory per backup cifrati.
- [x] Il backup manuale scarica ora esclusivamente un archivio `.nexora-backup` cifrato.
- [x] Eliminato l'adapter pubblico filesystem-directory; il restore portabile e Google Drive
  restano disponibili.
- [x] Rimossi riferimenti operativi a NAS/SMB dalla documentazione e dagli inventari correnti.

## Evidenze Fase 3

- [x] Creato il package `@nexora/application`, dipendente esclusivamente dal dominio.
- [x] Definito `LedgerSnapshot` come contratto di lettura multipiattaforma sul `LedgerRepository`.
- [x] La shell web carica ora il proprio modello tramite il layer applicativo condiviso.
- [x] Documentata la direzione delle dipendenze per browser, Tauri e futuri adapter SQLite nativi.

## Evidenze Fase 4

- [x] Formalizzati palette semantica, spaziatura, raggi e viewport nei token `@nexora/ui`.
- [x] Allineata la shell condivisa ai token Stitch senza duplicare la navigazione desktop/mobile.
- [x] Mantenuti skip link, focus visibile, dialog con trap focus e bottom navigation accessibile.

## Evidenze Fase 5

- [x] Verificati stati di avvio, progress, recovery guidato e diagnostica non distruttiva.
- [x] Aggiunto banner offline trasversale, visibile soltanto durante la disconnessione.
- [x] Il lavoro locale resta esplicitamente disponibile offline e il badge online non viene mostrato.

## Evidenze Fase 6

- [x] Corretto il blocco reale di startup sui ledger OPFS esistenti: la cronologia v13
  legacy `import-fingerprint-tombstones` viene riconosciuta, riparata in modo additivo
  (solo se manca `deleted_transaction_id`) e normalizzata senza reset o sostituzione dei dati.
- [x] Gli errori di migrazione, apertura OPFS/IndexedDB, timeout, incompatibilità, recovery
  guidato e caricamento dei modelli espongono codice, fase e categoria nella diagnostica.
- [x] La preferenza `nexora.ledger-storage.v1` viene scritta solo dopo apertura e verifica;
  un localStorage bloccato non invalida un ledger già verificato.
- [x] Verificata l'apertura reale nel browser con il ledger OPFS esistente e dati persistiti;
  lo sblocco della Fase 7 è stato registrato senza modificare l'archivio browser.
- [x] Corretta la regressione di avvio introdotta dal refresh runtime di Vite: il preambolo React
  è ora una dipendenza esplicita dell'entrypoint, prima della valutazione dei moduli della shell.
- [x] `NavIcon` usa un fallback sicuro per chiavi non mappate e non può più interrompere il mount.
- [x] Verificati avvio, reload, sidebar desktop e navigazione mobile sulla build di produzione.
- [x] La discovery di OPFS e IndexedDB è limitata per sonda, distingue archivi bloccati da timeout
  e conserva diagnostica non sensibile con fase, codice e archivio selezionato.
- [x] La persistenza della selezione avviene soltanto dopo la lettura riuscita dei modelli UI.
- [x] Dashboard, conti e movimenti leggono dati dal ledger tramite snapshot e view model separati.
- [x] Registrazione manuale, trasferimento, annullamento, cestino e split mantengono le invarianti
  contabili già testate nel dominio e negli adapter.
- [x] Aggiunto E2E del verticale completo: seed, conto, movimento e aggiornamento dashboard.
- [x] Confermati layout responsive, keyboard path e assenza di overflow nella superficie pilota.

## Evidenze Fase 7

- [x] Aggiunta la shell Tauri 2 per Windows con la stessa applicazione React/Vite condivisa.
- [x] Creato `@nexora/database-tauri`, adapter del plugin SQL verso la porta `SqliteDatabase`.
- [x] Il ledger nativo riusa repository, codec, backup portabile e catalogo completo delle 13
  migrazioni SQLite, senza introdurre uno schema parallelo.
- [x] Il bootstrap seleziona `native-sqlite` esclusivamente nel runtime Tauri; OPFS e IndexedDB
  conservano discovery, preferenza e recovery non distruttivo nel browser.
- [x] Il database applicativo è stato aperto realmente, chiuso e riaperto su Windows; il controllo
  di integrità restituisce `ok` e la cronologia contiene tutte le 13 migrazioni.
- [x] Verificati adapter, classificazione degli errori, backup, reset non distruttivo, typecheck,
  lint, unit/component test, build web e build release nativa.

## Avanzamento Fase 8

- [x] Audit iniziale di importazione, esportazione e qualità dati registrato nello stato Codex.
- [x] Conferma esplicita e commit di batch composti soltanto da trasferimenti, verificati a 320 e
  1440 px senza modificare le invarianti del repository.
- [x] Supporto e test espliciti per date seriali Excel, incluso il rifiuto conservativo del
  giorno fittizio 60 del calendario Excel 1900.
- [x] Conservazione dei valori sorgente e profili di mapping.
  - [x] Celle sorgente immutabili conservate nel record audit insieme ai valori normalizzati.
- [x] Profili di mapping persistenti, riutilizzabili e associati al batch tramite schema v14.
- [x] Importazione CSV generica con anteprima, mapping, audit sorgente e conferma esplicita.
- [x] Export JSON realmente completo tramite snapshot portabile dell'intero ledger, indipendente
  dai filtri CSV/XLSX, e report aggregato che contabilizza righe importate, ignorate e fallite.
- [x] Verificati parser e migrazioni, adapter SQLite/IndexedDB, import responsive, download JSON
  completo sui cinque viewport, lint, typecheck, unit/component test e build di produzione.

## Evidenze Fase 9

- [x] Estratto `PortableBackupEngine` come servizio unico, indipendente da UI, destinazione e
  backend persistente; browser OPFS/IndexedDB e Tauri delegano allo stesso contratto.
- [x] La creazione cifra lo snapshot portabile e lo decifra/valida prima di produrre ricevuta,
  checksum, manifest e archivio scaricabile o inviabile a un provider.
- [x] Verifica e compatibilità schema avvengono prima di ogni scrittura; passphrase errate,
  tampering, payload non portabili e schemi futuri sono rifiutati senza modificare il ledger.
- [x] Il restore conserva un checkpoint portabile del ledger corrente, verifica il risultato e
  ripristina automaticamente il checkpoint se la sostituzione o la verifica post-write fallisce.
- [x] Verificato round-trip cross-adapter IndexedDB→SQLite, restore IndexedDB, rollback dopo errore
  post-write, adapter browser/Tauri, typecheck, lint, test completi e build di produzione.

## Evidenze Fase 10

- [x] Il download manuale usa esclusivamente l'archivio cifrato e autoverificato prodotto dal
  Backup Engine condiviso; la passphrase resta soltanto nello stato volatile della pagina.
- [x] Il file selezionato deve superare una verifica read-only prima di abilitare il restore; la
  ricevuta mostra file, schema, data e prefisso checksum senza esporre dati finanziari.
- [x] Cambio file o passphrase invalida la ricevuta e il restore richiede un secondo dialogo con
  conferma esplicita, focus contenuto, Escape e ritorno del focus.
- [x] Errori di verifica o ripristino sono annunciati in modo accessibile e confermano che il ledger
  corrente non è stato modificato; checkpoint e rollback restano responsabilità dell'engine.
- [x] Verificati test component, round-trip OPFS reale, download/selezione/verifica tramite browser,
  WCAG automatizzata e assenza di overflow a 320, 375, 768, 1024 e 1440 px.

## Evidenze Fase 11

- [x] Google Identity Services usa esclusivamente lo scope `drive.appdata`; il token resta in
  memoria, viene revocato alla disconnessione e consenso negato/timeout falliscono in modo chiuso.
- [x] Il provider elenca solo metadati Nexora validi nella cartella privata, limita gli archivi a
  512 MiB e non ritenta upload POST per evitare copie duplicate dopo esiti di rete ambigui.
- [x] Upload e restore riusano l'archivio cifrato del Backup Engine: il download deve coincidere con
  dimensione e checksum Drive e superare la verifica read-only prima della conferma di restore.
- [x] La cancellazione cloud resta separata e opt-in nel ripristino totale; il normale flusso backup
  non elimina file remoti e la cancellazione opera soltanto sui backup Nexora enumerati.
- [x] Verificati provider, OAuth negativo/timeout/concorrenza, configurazione, UI component,
  accessibilità e layout backup sui viewport 320, 375, 768, 1024 e 1440 px.
- [x] L'onboarding account compare dopo l'apertura verificata del ledger, richiede un clic
  esplicito per `select_account`, consente di continuare offline e condivide una sola sessione OAuth
  volatile tra shell, backup e ripristino totale. Test component ed E2E configurato coprono focus,
  consenso negato, reload e viewport 320, 375, 768, 1024 e 1440 px.
- [ ] Collaudo end-to-end con un Client ID Google autorizzato e un account di test del deployment;
  nessuna credenziale reale è disponibile o incorporata nel repository locale.
