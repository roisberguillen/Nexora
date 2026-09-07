# Changelog

## Unreleased

- Added the 12.5.C5.0 cross-surface consistency framework, evidence matrix and initial audit.
- Closed C5.1 navigation, page chrome, terminology, navigation iconography and equivalent CTA consistency.
- Closed C5.2 mutation-form busy states and double-submit protection without changing domain or storage behavior.
- Closed C5.3 financial data consistency: shared bigint-safe money and locale-aware percentage formatters.
- Closed C5.4 responsive consistency: six-viewport shell/reflow audit, touch targets, overflow and zoom evidence reconciled.
- Closed C5.5 cross-surface regression sweep with no new runtime regressions; documented accessibility, security and performance sanity evidence.
- Closed 12.5.C5 with `C5_FINAL_GATE_PASS`; final browser, accessibility, financial, real-flow, security and performance gates reconciled.
- Completed 12.5.D.2 independent UI/UX + responsive review: browser evidence across 320/390/768/1024/1440, representative screenshots, and no P0/P1/P2 findings; D.3 remains next.
- Completed 12.5.D.3 independent WCAG 2.2 AA accessibility review: keyboard, focus, semantics, axe-core, responsive and zoom gates passed with no P0/P1/P2 findings; D.4 remains next.
- Completed 12.5.D.4 independent security review: threat model, secret/log scan, backup/restore, App Lock, import/export, CSP, Tauri, PWA, Local Host and supply-chain gates passed with no P0/P1/P2 findings; D.F remains next.
- Closed Phase 12.5.D with `12.5.D COMPLETE / PASS`: D.1–D.4 evidence reconciled, fresh verify/manifest gates green, and no P0/P1/P2 findings; 12.5.E.1 remains next and not started.
- Completed 12.5.E.1 Final Quality Gate: frozen install, verify, full 666-test E2E, manifest and state validation green; 12.5.E.2 remains next.
- Completed 12.5.E.2 Real-Flow Full Regression Gate: critical financial/operational flows, persistence, import idempotency, undo and backup/restore passed; 12.5.E.3 remains next.
- Completed 12.5.E.3 Data Integrity & Recovery Final Gate: encrypted round-trip, checksum/tamper rejection, rollback, restore and cross-adapter parity passed; 12.5.E.F remains next.
- Closed Phase 12.5.E with `12.5.E COMPLETE / PASS`: E.1–E.3 and final quality reconciliation passed; 12.5.F Release Freeze remains next.
- Closed `12.5.F COMPLETE / PASS`: the 12.5 release candidate is frozen after full quality, real-flow, integrity and recovery gates; Phase 13 is authorized but not started.
- Completed 13.0 Desktop Delivery Foundation: Tauri 2 native SQLite adapter, locked Rust check, Windows no-bundle build and startup smoke passed; 13.1 remains next.
- Completed 13.1 Desktop Shell and Native Persistence Parity: adapter/migration/SQLite tests, locked native check, Tauri build and desktop startup smoke passed; 13.2 remains next.
- Completed 13.2 Desktop packaging and distribution readiness: Windows MSI/NSIS bundles, native metadata/icon wiring, locked check, full verify and startup smoke passed; 13.3 remains next.
- Started 13.3 portability hardening after remote matrix evidence: aligned stale Linux visual baselines and clipped a 4px Linux root overflow; post-fix CI verification remains open.
- Closed 13.3 Cross-platform Desktop Release Matrix: macOS x64/arm64 Tauri bundles, locked checks and full verify passed in CI; Linux visual baselines and root overflow portability were hardened; the next task requires roadmap registration.
- Registered the remaining atomic roadmap from 13.4 through 17.F; no new task is marked complete and 13.4 is the next authorized task.

## 2026-09-06

- Chiusa C4 con `C4_FINAL_GATE_PASS`: matrice C4.0–C4.10 riconciliata, regressione Playwright
  completa eseguita due volte (secondo run seriale isolato), gate unit/lint/typecheck/build,
  offline/reload/reopen, responsive e zoom CDP verificati; `433 passed`, `233 skipped` dichiarati,
  `0 failed` su 666 test.

## 2026-09-05

- Completata C4.10 con flusso E2E completo App Lock → preferenze → cestino/restore → reset
  confermato → riapertura vuota → verifica e restore del backup cifrato; snapshot del ledger
  riconciliato su Chromium 390/1440, con PIN non esposto e lock mantenuto dopo reload/restore.
- Completata C4.9 con backup manuale `.nexora-backup`, verifica read-only, restore A → B → A,
  rollback post-write, IndexedDB offline, OPFS/SQLite e regressione Drive opzionale senza credenziali reali.
- Rafforzato il provider Google Drive: marker Nexora e metadati tecnici di data/dimensione inviati
  solo insieme all’archivio cifrato già verificato; archivi esterni esclusi dalla lista.

- Completata C4.8 con estratto CSV generico, mapping manuale e profilo persistente, commit atomico,
  deduplica post-undo, export CSV/XLSX filtrati senza movimenti annullati e JSON completo; verificati
  saldi, precisione minor-unit, trasferimento a due gambe, reload/reopen, IndexedDB offline e zoom CDP.
- Corrette la deduplica dei trasferimenti già annullati e lo stato vuoto Export: CSV/XLSX ora sono
  disabilitati senza risultati, mentre il JSON completo resta disponibile.

- Completata C4.7 con migrazione Money Manager XLSX locale: piano semantico, mapping, commit atomico,
  deduplica storica, audit/undo e trasferimenti a due gambe; verifiche su Conti, Categorie, Movimenti,
  Dashboard, Analisi e ricerca. Corretto il riconoscimento `Directa SIM` e la nota dei trasferimenti.
- Aggiunti gate E2E deterministici sui sei viewport, negativi, zoom CDP 200%, IndexedDB offline e
  OPFS/PWA reopen; prossimo flusso C4.8.

- Completata C4.6 con pannello Dashboard separato per debiti e investimenti: prestiti e posizioni
  restano fuori dai KPI e dal cash-flow, con filtro EUR e link accessibili alle superfici dedicate.
- Aggiunto il flusso E2E completo prestito/rata, investimento/valutazione, trasferimento, Dashboard
  e Analisi: sei viewport, zoom CDP 200%, negativi, persistenza e creazione/modifica offline IndexedDB.
- Riconciliazione finale verificata: disponibilità `9.468,00`, ledger `9.528,00`, prestito `4.828,00`,
  investimento `1.200,00`, rendimento `140,00 / 13,20%`; nessun P0/P1/P2 aperto.

## 2026-09-03

- Ripristinato il gate E2E dello zoom reale C4.1: la navigazione ora segue il landmark realmente
  visibile dopo il ridimensionamento CDP; full E2E verde con `378 passed`, `156 skipped`, `0 failed`.
- Completata C4.2 con il ciclo reale di entrata, due spese, dettaglio, ricerca, filtri, modifica,
  annullamento, riconciliazione Conti/Dashboard/Analisi, reload/reopen e prova offline IndexedDB;
  corretto anche lo stato `Contabilizzato` nel dettaglio e il ritorno del focus.
- Separata la quick action mobile “Nuova operazione” dal footer: ora è ancorata appena sopra
  la navigazione, allineata a destra e raggiungibile con il pollice senza alterare il flusso dati.
- Completata C4.1 con verifica UI end-to-end del primo avvio, profilo, primo conto, persistenza,
  nuova apertura e offline su OPFS e IndexedDB; resa disponibile la navigazione mobile verso Conti.

## 2026-09-04

- Completata C4.3 con trasferimenti atomici tra conti, annullamento senza alterare entrate/spese,
  persistenza dopo reload/reopen, rilettura offline IndexedDB, report neutrali e verifica zoom 200%.
- Chiuso il gate C4.3-R: failure C4.2 a 390 px non riprodotto con tre ripetizioni; regressioni mirate,
  full E2E, verify e controlli UI/UX/manifest completati senza correzioni applicative.

## 2026-09-02

- Definito il framework documentale C4.0 per la verifica dei flussi reali completi e registrata
  la matrice autorevole C4; C4.1 è il prossimo task e C3 resta congelata.

## 2026-08-30

- Closed the C3.9 Investments mobile/desktop screen audit with `SCREEN_AUDIT_PASS`; full-width
  editor, responsive reflow, CRUD, double-submit protection, Money/bigint precision and currency
  separation verified; Investments is frozen for C3.

- Closed the C3.8 Loans mobile/desktop screen audit with `SCREEN_AUDIT_PASS`; loan detail,
  CRUD, precision, responsive actions and protected deletion are verified and frozen for C3.
- Closed the C3.7 Recurring + Allocations mobile/desktop screen audit with `SCREEN_AUDIT_PASS`;
  responsive, confirmation, idempotency and transfer invariants verified, surfaces frozen for C3.
- Closed the C3.6 Budget mobile/desktop screen audit with `SCREEN_AUDIT_PASS`; Budget is frozen
  for C3 after responsive, period, threshold, hierarchy, accessibility and financial-propagation
  verification.

## [Unreleased]

- Chiuso C4.5-R2: Conti, Budget, Notifiche e riepiloghi si aggiornano immediatamente dal ledger locale
  dopo le allocazioni offline, senza richiedere un reload.

- Chiuso C4.5-R: il flusso completo di stipendio e allocazioni offline su IndexedDB persiste correttamente
  dopo reload e riconnessione, evita duplicati e non attende il refresh derivato per confermare il comando.

### Documentation

- Migliorata la formattazione desktop dell’elenco Conti: colonne e azioni ora restano leggibili
  senza testo troncato.

- Ripristinato il bordo inferiore continuo sulle righe Conti, incluso sotto il nome del conto.

- Centrate con flex le azioni delle righe Conti nella vista responsive.

- Disposte su una sola riga flex le azioni delle righe Conti mobile, con scorrimento interno sui
  viewport più stretti.

- Allineati i valori delle righe Conti mobile su una griglia coerente, mantenendo nomi, tipo e
  saldi su una riga quando lo spazio lo consente.

- Corretto il clipping dei valori nella tabella Conti mobile: l’ellissi resta limitata ai nomi
  lunghi, senza nascondere tipo e saldi.

- Corretto il flusso mobile dell’azione rapida “Nuovo conto”: il menu si chiude e viene mostrato
  direttamente il riquadro “Crea un conto”.

- Corretta la dimensione dei valori nelle card riepilogative di Analisi desktop: gli importi
  negativi lunghi restano contenuti nella griglia anche a 1440 px.

- Ripristinata la larghezza completa delle celle Conti mobile, evitando il collasso dei valori
  alla sola larghezza del testo.

- Centrato il badge di stato nella colonna Stato della tabella Conti desktop.

- Collegata l’azione rapida “Nuovo conto” direttamente al riquadro di creazione del conto.

- Abilitata la modifica controllata dei movimenti attivi importati, ricorrenti e di sistema,
  preservando origine e metadati di provenienza; trasferimenti collegati e movimenti riconciliati
  restano protetti.

- Aggiunto spazio inferiore alla legenda “Tipo movimento”, separandola visivamente dai pulsanti di
  selezione del tipo.

- Centrati esplicitamente contatore e pulsante “Seleziona” nel toolbar dell’intestazione Movimenti
  mobile, preservando l’ancoraggio del gruppo a destra.

- Allineato il padding dell’intestazione dell’editor Nuovo movimento a quello del form mobile,
  includendo titolo e chiusura.

- Centrati verticalmente titolo, contatore e azione dell’intestazione Movimenti mobile, mantenendo
  invariata la posizione orizzontale dei controlli.

- Allineato il padding dell’intestazione del pannello Movimenti mobile a quello dei filtri e del
  resto della pagina.

- Compattata la gerarchia del dettaglio movimento mobile, eliminando la distribuzione verticale
  eccessiva tra importo e metadati.

- Aggiunto spazio superiore al campo “Stato” nei dettagli avanzati del form Nuovo movimento,
  separandolo visivamente dal blocco Tag.

- Aggiunto spazio inferiore al gruppo “Tipo movimento” per separarlo visivamente dal campo
  Importo nel form Nuovo movimento.

- Rafforzato il padding diretto del form “Nuovo movimento” mobile, così i campi restano separati
  anche quando l’editor viene aperto a tutta larghezza.

- Aggiunto padding interno uniforme all’editor “Nuovo movimento” nella vista mobile, mantenendo
  l’editor a tutta larghezza senza far aderire i controlli ai bordi.

- Reso esplicito il bordo del selettore Ordina nei filtri Movimenti, mantenendo lo stile condiviso
  dei controlli.

- Estesa la larghezza dei filtri rapidi Movimenti su mobile: ogni riga distribuisce i pulsanti fino
  al bordo del contenitore, mantenendo wrapping e target touch.

- Azzerati margine e padding del campo di ricerca Movimenti su mobile, mantenendo invariati gli
  spazi del pannello e dei filtri rapidi.

- Centrato il gruppo dei filtri rapidi nella vista mobile Movimenti, mantenendo il wrapping e
  l’accessibilità dei pulsanti.

- Aggiunto padding orizzontale coerente al contenuto dei Filtri movimenti, incluso il foglio mobile,
  mantenendo pulsanti e ricerca dentro i limiti del pannello.

- Riordinate le righe dell’Albero categorie su desktop: contenuto e azioni restano sulla stessa
  linea quando possibile, evitando altezze artificiali senza cambiare il reflow mobile.

- Aggiunto il padding al contenuto vuoto dell’Albero categorie, mantenendo allineati testo e
  azione con il resto del pannello e preservando il padding interno della lista.

- Allineata la tipografia dei riepiloghi Analisi alla Dashboard tramite il componente/token
  condiviso `metric-value`, mantenendo il font finanziario e la formattazione EUR esistenti.

- Compattata la lista Conti: la colonna delle azioni usa una griglia desktop più densa per evitare
  righe artificialmente alte, mantenendo leggibilità, reflow mobile e target touch accessibili.

- Rifinita la lista Movimenti: righe più compatte e gerarchia visiva più pulita, mantenendo target
  touch accessibili. La modifica resta disponibile nel menu per le operazioni manuali; movimenti
  importati e trasferimenti restano protetti per preservare audit e collegamenti contabili.

- Corretta la griglia dei filtri Movimenti: i pulsanti rapidi e le azioni restano leggibili e non
  vengono più troncati nei layout stretti o nelle viste desktop affiancate.

- Chiusa C3.21 Startup + Recovery con `SCREEN_AUDIT_PASS / FROZEN`: bootstrap deterministico,
  recovery esplicito, lock fail-closed, verifica backup non distruttiva e layout responsive coerente
  con tema, testo e motion settings; nessun P0/P1/P2 aperto.
- Allineate loading e recovery startup ai token visivi e ai pulsanti condivisi dell’app, con padding
  e reflow sicuri da 320 px a desktop.

- Chiusa C3.20 Settings + Cestino + Reset con `SCREEN_AUDIT_PASS / FROZEN`: preferenze reali e
  persistenti, storage invalido con fallback sicuro, lifecycle soft-delete/restore/purge, reset
  finanziario e totale con conferme forti, atomicità, App Lock, backup e integrità finanziaria
  verificati su mobile, tablet e desktop.
- Aggiunto feedback accessibile quando il ripristino di un movimento dal Cestino fallisce.
- Uniformati padding, gap e separazione delle azioni nei dialog distruttivi di Settings, con verifica
  responsive dedicata.
- Allineati anche i margini laterali del dialog di conferma reset al contenuto del pannello Settings.
- Reso operativo il tema chiaro/scuro persistente su tutte le route, con modalità Sistema collegata
  alla preferenza del dispositivo.
- Verificate e rese effettive su tutte le route le preferenze Dimensione testo e Riduci animazioni,
  con persistenza al reload.
- Aggiunto padding coerente alle azioni e agli stati della sezione Connessione dispositivi.
- Reso l’header desktop coerente con il tema scuro e valorizzata la ricerca globale con bordo,
  contrasto e stato focus dedicati.

- Chiusa C3.19 Privacy/Sicurezza + App Lock con `SCREEN_AUDIT_PASS / FROZEN`: conferma del
  segreto, PBKDF2 senza plaintext, timeout, lock manuale, riautenticazione alla disattivazione,
  recovery totale esplicito, isolamento delle superfici sensibili e fallback fail-closed verificati
  su mobile e desktop. Secure storage nativo, biometria e lifecycle lock restano Phase 13.
- Rifinito il form di configurazione App Lock con padding interno coerente con i pannelli e
  verificato su tutte le viewport responsive.
- Aggiunto un distacco superiore coerente alla CTA “Attiva blocco” rispetto al selettore timeout.

- Chiusa C3.18 Profile con `SCREEN_AUDIT_PASS / FROZEN`: profilo locale con nome visualizzato,
  modifica/salvataggio/annulla, persistenza, validazione, privacy e responsive verificati.
- Eliminati dal Profilo i percorsi non supportati (email, avatar, upload, autenticazione e logout):
  la superficie ora espone solo dati e azioni realmente disponibili in locale.
- Rifinito il padding interno del pannello “I tuoi dati” del Profilo, verificato su desktop compatto
  e mobile senza overflow.
- Aggiunto anche spazio verticale sopra e sotto il contenuto del pannello Profilo per separarlo
  correttamente dai bordi.
- Aggiunta una distanza coerente tra la sezione “I tuoi dati” e “Sicurezza e impostazioni”.
- Uniformate altezza, padding e allineamento dei pulsanti “Salva profilo” e “Annulla” ai controlli
  condivisi dell’app.

- Chiusa C3.17 Notifications con `SCREEN_AUDIT_PASS / FROZEN`: derivazione locale, soglie Budget,
  deduplica, read/unread, badge, deep-link, privacy, timezone Europe/Rome e responsive verificati.
- Corretto il layout dei pannelli Notifiche, aggiunta lettura esplicita degli alert, esclusi alert
  duplicati o stale per soglie Budget e prestiti estinti; le notifiche OS-native restano rinviate
  alla Fase 13.
- Rifinito l’allineamento della lista Notifiche: contenuto e azioni sono ordinati su desktop e
  disposti in modo leggibile su mobile.
- Stabilizzato l’allineamento a colonne delle azioni Notifiche anche per le righe già lette;
  verifica Chrome desktop/mobile completata senza overflow.
- Uniformata la centratura visiva del link “Apri” con i bottoni della lista Notifiche.

- Chiusa C3.16 Backup + Restore con `SCREEN_AUDIT_PASS / FROZEN`: archivio cifrato, schema/versione,
  preview dei contenuti, restore confermato, atomicità, rollback, sicurezza e responsive verificati.
- La preview Backup mostra i conteggi reali del ledger e il lock UI protegge le operazioni locali e
  Drive dal doppio submit.
- Chiusa C3.15 Export con `SCREEN_AUDIT_PASS / FROZEN`: CSV, XLSX e JSON completo verificati per
  scope, precisione, relazioni, privacy, formula safety e responsive mobile/desktop.
- Corretto il reflow mobile delle CTA Export, protetti i download dal doppio submit e reso esplicito
  lo stato vuoto dei filtri; aggiunta verifica programmatica del CSV e zoom 200% desktop.

- Chiusa C3.14 Import con `SCREEN_AUDIT_PASS / FROZEN`: formati reali, preview read-only, mapping,
  deduplica, trasferimenti, atomicità, undo, sicurezza e responsive mobile/desktop verificati.
- Chiarita la presenza del CSV tra i formati supportati e mostrato il nome del file nei pannelli
  di piano, mapping e anteprima; aggiunta regressione zoom 200% su desktop.

- Chiusa C3.13 Tag con `SCREEN_AUDIT_PASS / FROZEN`: responsive, CRUD, associazioni multi-tag,
  protezione duplicati, rename/merge, integrazione Movimenti, accessibilità e sicurezza verificate.
- Chiusa C3.12 Categorie con `SCREEN_AUDIT_PASS / FROZEN`: tree responsive, CRUD, gerarchia,
  riferimenti per ID, protezioni distruttive, accessibilità e integrazioni cross-screen verificate.

- Normalizzati i file del progetto con Prettier e rigenerato `PROJECT_MANIFEST.json`; tutti i gate
  di conformità C3.11-F risultano verdi.

- Stabilizzati i test date-sensitive del view model Dashboard con una data esplicita nelle fixture;
  il comportamento runtime continua a usare la data corrente.

- Aggiunto un distacco superiore coerente al pannello “Movimenti recenti” della Dashboard.

- Aumentato a `32px` lo spazio inferiore dello stato vuoto “Spese principali” per una chiusura più
  ariosa e coerente del pannello Dashboard.

- Aggiunto un distacco superiore coerente al pannello “Disponibilità / Conti” della Dashboard.

- Bilanciato lo spazio inferiore dello stato vuoto “Spese principali” nella Dashboard mobile e
  desktop.

- Aggiunto spazio inferiore coerente al pannello “Movimenti recenti” della Dashboard su mobile e
  desktop.

- Aggiunto spazio inferiore coerente ai pannelli Confronto e Spese principali della Dashboard su
  mobile e desktop.

- Aggiunta l’azione “Diario finanziario” al menu rapido mobile `+`, con navigazione diretta alla
  superficie Journal.

- Allineata la tipografia della sintesi del Diario alla Dashboard: label Inter condivise, importi
  JetBrains Mono con dimensione/peso coerenti e segno positivo esplicito per entrate e risparmio.

- Ripristinato l'inset orizzontale coerente della sintesi del Diario: descrizione e metriche
  mantengono ora spazio uniforme dai bordi su mobile e desktop.

- Chiusa la review C3.11 del Diario finanziario con CRUD responsive, keyboard, privacy e isolamento
  dai dati finanziari verificati; superficie congelata per C3.

- Avviato il redesign C3.10 Analytics: mese selezionabile come sorgente unica, sintesi KPI,
  confronto, trend 3/6/12 mesi, media spese, categorie split-aware, insight deterministici,
  storico accessibile e previsione spostata in fondo.

- Corretto il padding interno dei pannelli Analisi: previsione, confronto, grafico e tabella ora
  mantengono un inset uniforme dal bordo su desktop e mobile.
- Aggiunto un distacco verticale coerente tra i pannelli Analisi e mantenuto il margine inferiore
  del contenuto del confronto.

- Adjusted Movimenti inner spacing so search labels, date headings, and transaction rows keep a
  readable inset from the panel edges on desktop and mobile.

- Fixed mobile Movimenti `Nuovo movimento`: the standalone editor now fills the screen width and
  opens with the `Conto` field visible before the transaction list.

- Fixed the Transactions quick-filter toolbar: desktop and mobile filters now use Nexora styling,
  preserve 44 px touch targets, and expose a clear selected state.

- Closed Dashboard/Home `12.5.C3.3-R4`: aligned the visible and accessible H1, regenerated and
  revalidated the 1440 px visual baseline, and recorded final browser/evidence closure.

- Completed Dashboard/Home `12.5.C3.3-R3` hardening: zero-value trend bars no longer imply quantity,
  overlapping budgets are not aggregated, availability account counts share the same EUR/liquid
  scope, the header is compact, and the no-budget state is no longer duplicated.

- Corrected Dashboard/Home in `12.5.C3.3-R2`: monthly EUR KPIs, current period/status, liquid
  availability, savings rate, budget progress, recurring upcoming expenses, month-over-month
  trend, top categories and compact recent activity now use real ledger projections.

- Fixed Global Search desktop clear focus regression; the input now retains keyboard focus after clearing the query, with component and E2E coverage.
- Closed Phase 12.5.C3.4 Accounts/Conti with `SCREEN_AUDIT_PASS`; corrected mobile touch targets and hid invalid delete actions for accounts with activity.
- Closed Phase 12.5.C3.3 Dashboard/Home with `SCREEN_AUDIT_PASS`; recorded responsive browser
  evidence for empty/populated states, financial projections, accessibility and zoom 200%.
- Closed Phase 12.5.C3.1 App Shell + Navigation with `SCREEN_AUDIT_PASS`; added drawer focus
  management, responsive browser evidence and C3 tracking.
- Prepared the Phase 12.5.C3.0 screen-by-screen Mobile/Desktop audit framework, 34-surface
  inventory, review template and tracking matrix.
- Retired only the obsolete `mockup-to-ui` and `quality-gates` skills; their review process is
  superseded by the enforced manifest gate.
- Added the mandatory `nexora-ui-ux-mobile-desktop/v1` change manifest, review template and
  staged-commit gate. Every modification now needs a recorded PASS/N.A. review without open P0.
- Reconciled Phase 12.5.D status: a historical completion note lacked a dedicated independent
  review/evidence; D is therefore `IN PROGRESS`, with D.2 UI/UX + responsive as the next task.

- Completed the read-only Phase 12.5.1 mapping checkpoint for the user-provided financial sources.
  It documents explicit date, account, currency, category and transfer review rules without
  persisting or committing any real financial row.

- Completed UI architecture roadmap Phase 1 with the verified Stitch screen-to-feature matrix,
  component boundaries, data-contract mapping and implementation sequence.

### Changed

- Chiuso il Final Transactions Gate 12.5.C2.9 con `TRANSACTIONS_GATE_PASS`: la superficie
  Movimenti è congelata dopo la verifica funzionale, responsive, accessibilità e invarianti.

- Completato 12.5.C2.8: Movimenti ora protegge ogni mutazione dal doppio submit, espone loading/
  disabled/error feedback accessibili e mantiene validazione, focus, responsive behavior e transfer
  read-only verificati su tutti i viewport; nessuna regola finanziaria o persistence contract è cambiata.

- Risolto il blocker C2.6: i trasferimenti registrati sono esplicitamente non modificabili dalla
  UI e una guardia impedisce qualsiasi falso update o nuova creazione nello stato impossibile
  `transfer + editingId`; creazione atomica, annullamento e KPI restano invariati.

- Il modulo “Nuovo movimento” presenta ora Entrate e Uscite con una gerarchia bancaria: tipo e
  importo in evidenza, seguiti da conto, controparte, categoria, data e descrizione. Ripartizioni,
  tag, stato e classificazioni della spesa restano disponibili in “Altri dettagli”, chiuso per
  impostazione predefinita; conversione monetaria, validazioni, comandi e trasferimenti esistenti
  non cambiano. In modifica, le classificazioni Fissa/Variabile e Ordinario/Straordinario già
  presenti sono precompilate e quindi non vengono perse.

- Movimenti ora raggruppa cronologicamente le righe e offre un dettaglio contestuale accessibile;
  la route di nuova registrazione ripristina correttamente editor, transfer, split e dettagli
  finanziari su desktop e mobile.

- La pagina Movimenti espone ora una gerarchia bancaria più immediata: titolo essenziale, accesso
  esplicito al flusso esistente di nuova registrazione e KPI di entrate, uscite e saldo netto
  calcolati dal report finanziario già verificato, senza includere trasferimenti o annullati.

- Completata la Fase 12.5.C: navigazione desktop raggruppata e riducibile, filtri movimenti
  combinabili e modifica sicura dei movimenti manuali. Le modifiche preservano atomicamente split
  e tag su memoria, IndexedDB e SQLite; movimenti importati, riconciliati, annullati e transfer
  restano protetti.

- Corretto definitivamente l'import Money Manager: piani globali per conti e categorie, creazione
  differita e atomica delle entità mancanti, transfer reali, rettifiche saldo, profili semantici,
  deduplica e undo coerente su memoria, IndexedDB e SQLite. La validazione locale isolata ha
  riconciliato 45/45 righe reali senza conservare dati finanziari nel repository.

- Fixed local-account resolution in the import preview: statements without an account column can
  become committable only after an explicit account choice and only when their date and amount are
  already valid. Invalid source rows remain review-only.

- Completata la Fase 12 della roadmap UI e finanziaria il 2026-08-14. La review finale ha
  allineato codice, test e documentazione per budget, ricorrenze, allocazioni, prestiti,
  investimenti, analisi, diario, categorie, tag, notifiche e impostazioni/privacy. La CI GitHub
  ha verificato build, qualità, manifest e Playwright sul commit di chiusura.

- Rafforzate le superfici finali di Fase 12: investimenti validati contro conto attivo di tipo e
  valuta corretti in repository e snapshot; eliminato l'import CSV locale non atomico; default
  civili `Europe/Rome` per movimenti, investimenti e Diario; copertura component/E2E per Analisi,
  Diario e Notifiche.

- Finalizzata la Fase 12.5: i piani di allocazione in Ricorrenze ora supportano modifica,
  pausa/riattivazione ed eliminazione confermata. Le conferme creano trasferimenti reali e
  idempotenti anche in caso di retry dopo errore parziale, senza alterare lo storico esistente.

- I budget mensili sono ora configurazioni ricorrenti con revisioni effettive nel tempo: una
  modifica futura conserva lo storico, la disattivazione è non distruttiva e la pagina consente
  di consultare i mesi precedenti. La migrazione additiva v19 e IndexedDB v19 preservano budget,
  backup portabili, notifiche e dati legacy.

- Corretto il modulo Budget: il form assegna automaticamente il mese corrente e richiede
  Categoria, Sotto-categoria, importo e due soglie percentuali configurabili. Le soglie sono
  validate fra 1 e 100 e in ordine crescente; notifiche e snapshot portabili le usano senza
  duplicare il centro notifiche. La migrazione additiva v18 conserva i budget legacy con avvisi
  attivi come soglie storiche 80/100.

- Finalizzata la Fase 12.4: i budget mensili supportano creazione, modifica ed eliminazione
  confermata, perimetri globali, macro-categorie e sottocategorie. Il consumo usa solo spese
  contabilizzate, attribuisce correttamente gli split senza doppio conteggio e mantiene il vincolo
  di un solo budget per periodo e perimetro su SQLite/OPFS, IndexedDB e memoria.

- Finalizzata la Fase 12.3: le ricorrenze supportano calendario settimanale, mensile e annuale con
  intervallo, data nominale distinta dalla data effettiva e migrazione additiva v17. Le anteprime
  restano non distruttive e non creano movimenti automaticamente.

- Finalizzata la Fase 12.2: l'editor Ricorrenze aggiorna subito le categorie compatibili con il
  tipo selezionato, non conserva valori della regola precedente e mantiene l'importo nel formato
  decimale corretto durante la modifica.

- Le spese possono ora conservare facoltativamente natura `fissa`/`variabile` ed evento
  `ordinario`/`straordinario`, senza modificare le categorie esistenti, le entrate, i
  trasferimenti o le rettifiche. La migrazione additiva v16, IndexedDB, SQLite/OPFS, backup
  portabili ed export mantengono i valori; le importazioni non deducono mai questa classificazione
  da categorie legacy.

- Il modulo movimenti offre dettagli finanziari accessibili e richiudibili solo per le spese. Le
  ricorrenze restano regole mensili indipendenti con pausa, riattivazione ed eliminazione
  confermata, senza un flag ricorrente duplicato sui movimenti già contabilizzati.

- Le categorie finanziarie ora supportano Macro categoria → Sottocategoria con vincoli condivisi
  per SQLite, IndexedDB e memoria. La tassonomia iniziale di entrate e uscite è installabile solo
  con un'azione esplicita su un archivio senza categorie personali; le categorie e i movimenti
  esistenti non vengono riassegnati. Il selettore dei nuovi movimenti mostra il percorso gerarchico
  e non propone categorie archiviate.

- Resi chiari e recuperabili i reset locali: la passphrase serve solo per un nuovo backup cifrato
  facoltativo, mentre il ripristino totale non richiede PIN o passphrase, elimina esplicitamente il
  blocco app e non tocca i backup Google Drive. La schermata bloccata offre ora il recupero totale
  dopo l'apertura sicura del ledger.

- Corretto il ripristino di backup portabili su SQLite/OPFS quando il ledger contiene sottoconti
  o categorie gerarchiche: i vincoli esterni vengono differiti all'interno della sostituzione
  atomica, con checkpoint e rollback invariati.

- Completato il collaudo live di Google Drive: consenso esplicito, upload di archivio cifrato,
  rilettura, verifica read-only e ripristino con riapertura del ledger sono stati confermati senza
  persistere token OAuth o passphrase.

- Corretto il pulsante **Continua con Google** del ponte OAuth: l'handler ora è un file locale
  autorizzato dalla Content Security Policy, quindi la finestra risponde al clic anche quando
  Google Identity Services non è ancora pronta.

- Corretto il ritorno dal consenso Google Drive in Chrome con una pagina ponte OAuth dedicata:
  la shell mantiene l'isolamento SQLite/OPFS, mentre il token volatile rientra solo tramite un
  canale vincolato a nonce dopo la conferma esplicita dell'utente.

- Il selettore account Google Drive ora preserva il clic esplicito dell'utente: il client GIS si
  prepara soltanto nella pagina Backup e il pulsante di collegamento resta disponibile quando il
  popup può essere aperto correttamente, senza token persistenti o modifiche ai dati locali.

- Rafforzato il collegamento Google Drive: il caricatore GIS gestisce tentativi successivi con
  script già presenti e gli errori del popup sono annunciati subito con indicazioni di recupero,
  senza conservare token o modificare dati locali.

- Google Drive è ora richiesto esclusivamente dalla pagina Backup dopo un'azione esplicita. Nessun
  dialogo OAuth o collegamento account viene mostrato all'avvio: l'app resta locale e utilizzabile
  offline finché l'utente non sceglie di creare, ripristinare o sincronizzare un backup Drive.

- Implementata la Fase 11 Google Drive con OAuth `drive.appdata`, token solo in memoria, provider
  validato, upload cifrato senza retry duplicanti e restore abilitato soltanto dopo verifica
  read-only di dimensione/checksum e conferma esplicita. Il collaudo OAuth live resta vincolato a
  un Client ID autorizzato del deployment e non viene simulato nel repository.

- Completata la Fase 10: il backup manuale scarica un archivio autoverificato e il restore è
  abilitato solo dopo verifica read-only, ricevuta tecnica e conferma esplicita; cambio file o
  passphrase revoca la verifica senza modificare il ledger attivo.

- Completata la Fase 9 con un Backup Engine portabile condiviso da OPFS, IndexedDB e SQLite
  nativo: creazione autoverificata, controllo schema pre-write, restore cross-adapter e rollback
  automatico verificato, senza cambiare cifratura o destinazioni supportate.

- Completata la Fase 8: l'export JSON usa lo snapshot portabile completo e versionato del ledger,
  senza filtri impliciti, mentre la cronologia import espone un report qualità aggregato e
  accessibile per righe importate, ignorate e fallite.

- Aggiunto l'import CSV generico locale con rilevamento sicuro del delimitatore, campi quotati,
  anteprima/mapping, conferma esplicita e tipo batch dedicato tramite schema v15.

- Aggiunti profili di mapping import riutilizzabili e validati, con selezione esplicita nella UI
  e associazione persistente al batch tramite migrazione additiva SQLite/IndexedDB v14.

- Ogni riga letta dagli importer conserva ora le celle sorgente immutabili nel payload di audit,
  separandole dai valori normalizzati usati per il dry-run e la contabilizzazione.

- L'anteprima Money Manager conserva i valori numerici grezzi dei workbook e normalizza le date
  seriali Excel in ISO-8601; il giorno fittizio 60 viene inviato alla revisione manuale.

- I batch di importazione composti soltanto da trasferimenti tra conti propri possono ora essere
  confermati dopo la selezione esplicita delle righe, mantenendo il commit atomico esistente.

- Aggiunto il Nexora Task Orchestrator repo-level con routing ECONOMY/STANDARD/ADVANCED/CRITICAL,
  limiti di contesto e tentativi, test progressivi, checkpoint ed escalation senza switch di
  modello impliciti.

- Completata la Fase 7 multipiattaforma: Nexora dispone ora di una shell Tauri 2 e di un ledger
  SQLite nativo che riusa le 13 migrazioni, i repository e i backup portabili condivisi, mantenendo
  invariati OPFS e IndexedDB nella PWA.

- Restored application startup after the Phase 6 Vite React preamble regression. Navigation icon
  lookup now has a safe default and a pre-mount recovery screen prevents blank pages.
- Hardened non-destructive ledger startup diagnostics and verification: OPFS/IndexedDB discovery
  is bounded, model loading completes before backend selection is persisted, and recovery reports
  the safe technical failure category.
- Restored existing OPFS ledger loading when a known legacy v13 migration name is present;
  compatibility repair is additive and transactionally normalizes only that migration record.
- Startup diagnostics now identify safe read-model/UI-model phases and named repository reads;
  development no longer registers the Service Worker and the dev server is fixed to port 5173.
- Replaced browser directory/NAS backup selection with an explicit encrypted `.nexora-backup`
  download; portable restore and Google Drive remain available.
- Added the platform-independent `@nexora/application` read layer and migrated the web shell to
  its shared ledger snapshot contract.
- Formalized the shared Nexora visual tokens and aligned the responsive application shell with
  the Stitch reference palette and geometry.
- Added a screen-reader-friendly offline state while preserving local-first work and a silent
  online state.
- Added end-to-end coverage for the pilot dashboard, accounts and transactions vertical slice.

- Completata la Fase 0 della roadmap UI e multipiattaforma: il mockup Stitch è ora il
  riferimento ufficiale per struttura e responsive, mentre palette, font e invarianti Nexora
  restano la fonte applicativa. Tauri 2/SQLite nativo, Local Hub Rust e la policy backup
  `.nexora`/Google Drive sono documentati negli ADR dedicati.

- Avviata la roadmap LAN: l'host locale è opt-in, il pairing è vincolato al fingerprint
  dell'host e i token per dispositivo sono a breve durata, con controlli di origine e scadenza.

- Reso deterministico il bootstrap del ledger: la UI mostra la fase reale di
  discovery/apertura/verifica, i timeout sono espliciti, un errore chiude il ledger
  parzialmente aperto e invocazioni concorrenti non duplicano l'apertura.
- Le preferenze storage malformate vengono rimosse in sicurezza prima della discovery,
  senza compromettere l'accesso a un archivio IndexedDB valido.
- Il recovery guidato consente ora di aprire esplicitamente un archivio OPFS o IndexedDB
  rilevato, senza selezioni automatiche quando esistono più archivi locali.
- Rafforzato il cleanup di bootstrap: una risposta ledger non conforme non nasconde più
  l’errore originale durante l’avvio o nei test browser.
- Il recovery guidato può verificare un backup cifrato selezionato senza aprire o
  modificare l’archivio locale attivo.
- Resa raggiungibile la pagina Impostazioni dalla navigazione desktop.
- Il recovery guidato può ora provare un restore di backup portabili in un IndexedDB
  temporaneo, verificarne i movimenti e rimuovere la copia senza toccare il ledger attivo.
- L'apertura e la migrazione del ledger usano Web Locks quando disponibili per evitare
  aperture concorrenti tra schede.
- Se OPFS era assente e risulta indisponibile durante l'apertura, l'avvio passa
  esplicitamente a IndexedDB; archivi OPFS esistenti non vengono mai mascherati.
- Aggiunta una Content Security Policy per sviluppo e preview, compatibile con
  SQLite WebAssembly e con l'isolamento cross-origin richiesto da OPFS.
- Estese le verifiche browser dell'avvio a 50 reload consecutivi e cinque schede
  simultanee, serializzate tramite Web Locks quando disponibili.
- Aggiunto un benchmark Chromium su IndexedDB reale che inserisce, riapre e legge
  100.000 movimenti sintetici in un archivio temporaneo eliminato al termine.
- Aggiunta l'equivalente prova Chromium su SQLite WASM/OPFS con 100.000 movimenti
  sintetici, isolata in una directory OPFS temporanea e rimossa al termine.
- Verificato in Chromium il rollback di una scrittura interrotta sia su IndexedDB
  sia su SQLite WASM/OPFS, con riapertura senza record parziali.
- La tabella Movimenti è ora paginata e rende al massimo 100 righe per pagina,
  preservando selezione e azioni anche su ledger molto grandi.
- La PWA avvisa esplicitamente quando è disponibile una nuova versione e permette
  all'utente di ricaricarla in modo controllato, evitando sessioni con chunk obsoleti.
- La navigazione hash ripristina lo scroll in alto, evitando che i titoli delle nuove
  pagine restino sotto la barra desktop fissa.
- La lista Movimenti mobile riduce la densità delle etichette, separa le azioni e
  aggiunge spazio sicuro sopra la navigazione inferiore.

- Rafforzata la chiusura della roadmap di avvio: test browser della policy fail-safe per
  preferenze storage, archivi ambigui/bloccati/corrotti, retry, migrazioni e diagnostica
  di capability Worker, WASM e cross-origin.

- Completato l’hardening della release: benchmark ripetibile da 1.000 a 100.000 movimenti,
  recovery drill di snapshot portabile, controlli di integrità dei backend, scansione dei segreti
  e report finale quality-gated su `main`.

- Aggiunto il centro **Gestione dati** nelle impostazioni, con percorsi espliciti per elementi
  archiviati, cestino, backup ed esportazione e zona pericolosa. Le preferenze finanziarie non
  ancora operative non sono più presentate come controlli modificabili.
- I dialog distruttivi delle impostazioni ora intrappolano il focus, si chiudono con Escape,
  restituiscono il focus al controllo invocante e comunicano avanzamento, successo ed errori
  specifici tramite regioni accessibili. La verifica E2E copre 320, 375, 768, 1024 e 1440 px.

- Completata la gestione dati di conti, categorie e tag: `Svuota conto` sposta atomicamente i
  movimenti nel cestino dopo frase di conferma e PIN opzionale; le categorie si uniscono con
  riassegnazione coerente di movimenti, split, budget e ricorrenze; i tag possono essere uniti
  con deduplica o rimossi globalmente. Le categorie di sistema restano protette.

- Completato il cestino dei movimenti: selezione multipla con riepilogo e conferma, rollback
  atomico su SQLite/OPFS e IndexedDB, svuotamento esplicito del cestino e ripristino per gruppo.
  La conservazione è configurabile localmente (30 giorni di default); gli elementi scaduti sono
  soltanto segnalati, senza eliminazioni automatiche in background.

- Il ripristino totale distingue reset locale e pulizia Google Drive opzionale, richiede
  autorizzazione al momento dell’azione e conserva un report tecnico non sensibile tra reload.

- Il reset finanziario ora mostra una preview, richiede un backup cifrato verificato o un consenso
  distinto senza backup, richiede il PIN quando il blocco app è attivo e conserva una ricevuta
  tecnica senza dati finanziari.

- Rafforzati i flussi distruttivi: reset finanziario atomico anche per le gerarchie OPFS,
  ripristino totale locale, cestino/restore/purge e relative conferme accessibili.
- Aggiunta copertura component, adapter SQLite e IndexedDB, e E2E responsive (320, 768 e
  1440 px) per cestino, reset finanziario e ripristino totale.

- Riallineata la baseline di `main`: versione build centralizzata dal manifest root, report
  verificabile, roadmap quality-gated e rimozione del Dockerfile placeholder non produttivo.

- Aggiunto il cestino persistente dei movimenti: trasferimenti trattati come gruppo atomico,
  ripristino esplicito ed esclusione da saldi, budget e analisi.
- Aggiunta la cancellazione definitiva protetta dal cestino, con rimozione atomica di split e tag
  e conservazione dell'audit tecnico delle righe d'importazione.
- Introdotta la migrazione additiva SQLite/IndexedDB v13 per il riferimento storico delle righe
  importate a un movimento eliminato definitivamente.

## [0.5.0-rc.1] - 2026-07-29

- Introdotto il backup logico `.nexora-backup` cifrato e portabile tra SQLite/OPFS e IndexedDB,
  con restore atomico, verifica non distruttiva e cronologia locale delle operazioni.
- Reso il backup Google Drive più robusto con stato OAuth esplicito, disconnessione, timeout,
  retry dei soli fallimenti temporanei e messaggi sicuri.
- Completato il centro notifiche locale: backup e recovery drill scaduti, saldo basso configurabile,
  entrata attesa mancante, priorità, stato letto/ignorato e fallback interno.
- Aggiunti round-trip cross-adapter, benchmark da 1k a 100k movimenti e gate RC su 320/768/1440.

- Aggiunto il blocco opzionale dell’app con verificatore PBKDF2, timeout di inattività e blocco
  manuale. PIN e passphrase non vengono mai salvati; il ledger locale resta esplicitamente non
  cifrato a riposo dal browser.
- Rafforzata la comunicazione di sicurezza e aggiunta redazione per token, passphrase e IBAN nei
  testi diagnostici prima di un eventuale uso nei log.

- Avviata la vertical slice UI mobile: barra inferiore accessibile, menu rapido con cinque azioni,
  route della nuova registrazione e selettore unificato Entrata/Uscita/Trasferimento.
- Aggiunti Profilo, Impostazioni locali e Centro notifiche derivato da budget, rate e ricorrenze;
  lo stato letto o ignorato resta separato dal ledger nel solo storage locale.
- La UI Backup mobile integra Google Drive solo dopo configurazione OAuth esplicita: token in
  memoria, scope `drive.appdata` e upload di archivi già cifrati e verificati localmente.

- Completata la vertical slice Backup ed export: backup SQLite/OPFS cifrati con checksum,
  ripristino protetto da UI e sincronizzazione opzionale su Google Drive `appDataFolder`.
  I token OAuth restano in memoria e Drive riceve esclusivamente archivi AES-GCM già verificati.
- Aggiunto il diario mensile persistente, con migrazione additiva SQLite/IndexedDB v11,
  riflessioni locali e obiettivi per il mese successivo.
- Aggiunta la pagina Analisi con trend mensili e previsione spese prudente, oltre a un benchmark
  sintetico su 100.000 movimenti e al threat model operativo.
- Completato l’hardening di release: audit dipendenze senza vulnerabilità note, quality gate,
  recovery E2E e verifiche responsive Chromium su 320, 768 e 1440 px.

- Aggiunta la pagina Esporta: CSV locale dei movimenti e JSON del ledger senza invio di dati,
  con importi in minor units e neutralizzazione della formula injection nel CSV.

- Completata la vertical slice importatori bancari: anteprime locali Mediobanca XLSX e N26 PDF,
  audit con tipo importatore persistente e revisione per riga.
- I trasferimenti riconosciuti fra conti locali richiedono una conferma esplicita e vengono
  salvati o annullati atomicamente con le rispettive due gambe su SQLite/OPFS e IndexedDB.

- Completata la vertical slice Budget, Prestiti e Investimenti: budget mensili con soglie,
  posizioni Findomestic/Agos configurabili, valutazioni investimento e dashboard di debiti
  e rendimento.
- Aggiunte migrazioni additive SQLite/IndexedDB v7-v9 per budget, prestiti e posizioni
  investimento, con test adapter e riapertura.

- Completata la vertical slice Ricorrenze e allocazioni: regole mensili persistenti,
  policy stipendio italiana, piani di trasferimento per stipendio/reddito fotografico e
  conferma esplicita prima di ogni scrittura nel ledger.
- Aggiunte migrazioni additive SQLite e IndexedDB v5/v6 per `recurring_rules` e
  `allocation_plans`, con persistenza e riapertura verificate.
- Aggiunto il rilevamento prudente dello stipendio contabilizzato atteso e la proposta
  accessibile di allocazione; test E2E su 320/768/1440 px.

- Completata la vertical slice Money Manager XLSX: dry-run conservativo, deduplica con
  fingerprint SHA-256, commit atomico di batch/righe/movimenti e annullamento conservativo.
- Aggiunta la migrazione additiva SQLite e IndexedDB v4 per `import_batches`, `import_rows`
  e provenienza dei movimenti importati, senza alterare i dati degli schemi precedenti.
- Aggiunto lo storico auditabile degli import con righe duplicate o da revisionare e test E2E
  del caricamento, conferma e undo sui viewport 320/768/1440 px.

- Aggiunta l'anteprima locale dei workbook XLSX Money Manager: lettura dei fogli,
  rilevamento delle intestazioni e normalizzazione conservativa di date/importi in
  minor units, senza scritture nel ledger.
- Aggiunta la schermata Importa con caricamento locale, selezione foglio, mapping
  modificabile e riepilogo accessibile delle righe pronte o da revisionare.

- Aggiunta l'assegnazione di tag ai movimenti, salvata atomicamente insieme a transazione ed
  eventuali split su memoria, SQLite/OPFS e IndexedDB.

- Aggiunta la ricerca globale offline per conti, categorie, tag e movimenti, con risultati
  navigabili e test E2E responsive.

- Aggiunto il modello di split persistenti con migrazione SQLite/IndexedDB v2 e controlli
  di integrità su totale, segno, valuta e categoria.

- Aggiunta la pagina Movimenti con registrazioni manuali di entrate, spese e
  rettifiche, oltre a trasferimenti interni same-currency.
- Aggiunto l'annullamento conservativo su repository in-memory, SQLite/OPFS e
  IndexedDB: le due gambe di un trasferimento vengono annullate insieme e i movimenti
  riconciliati restano protetti.
- Aggiunti test di comandi, proiezione, adapter persistenti e flusso E2E responsive
  per la gestione dei movimenti.

- Aggiunto lo schema SQLite v1 `STRICT` per conti, categorie, transazioni e trasferimenti.
- Aggiunta la migrazione iniziale reversibile con importi `bigint` persistiti come testo
  decimale canonico.
- Aggiunti vincoli e test SQLite per integrità referenziale, segni, date, valute,
  trasferimenti e rollback atomico.
- Aggiunto il runner forward-only con catalogo contiguo, transazioni atomiche e storico
  idempotente.
- Imposto un backup verificato obbligatorio prima delle migrazioni dichiarate
  distruttive.
- Aggiunto `SqliteLedgerRepository` con codec dominio, coda seriale e scritture
  transazionali.
- Aggiunto SQLite WASM su OPFS in worker dedicato con gestione tipizzata
  dell'indisponibilità.
- Verificata in Chromium la persistenza OPFS dopo chiusura e riapertura del database.
- Aggiunto il fallback IndexedDB v1 con codec condivisi, transazioni atomiche e
  precisione `bigint` invariata.
- Aggiunto il selettore browser fail-safe: il fallback è ammesso solo quando OPFS è
  esplicitamente indisponibile.
- Verificata in Chromium la persistenza IndexedDB dopo chiusura e riapertura.
- Aggiunto il seed dimostrativo sintetico con conti, categorie, transazioni e
  trasferimento interno.
- Reso il seed idempotente, ripristinabile dopo un'esecuzione parziale e conservativo
  sui ledger non vuoti o con identificatori in conflitto.
- Aggiunto il backup fisico SQLite/OPFS con manifest, doppio checksum e cifratura
  AES-256-GCM derivata da passphrase.
- Aggiunto lo store filesystem locale con rilettura obbligatoria prima della ricevuta
  per migrazioni distruttive.
- Aggiunto il restore OPFS con validazione preventiva in memoria, controllo schema e
  rollback automatico del database precedente.
- Verificato in Chromium il ciclo backup, modifica, restore e riapertura su OPFS reale.
- Integrata la PWA con il repository persistente e una singola apertura condivisa con
  React.
- Resa stabile tra le sessioni la scelta OPFS/IndexedDB, senza fallback implicito
  quando il backend registrato non è disponibile.
- Aggiunti stati accessibili di apertura, pronto ed errore con backend, versione schema
  e conteggi locali.
- Esposto il seed sintetico soltanto tramite un'azione esplicita su archivio vuoto.
- Incluso il runtime SQLite WASM nel precache e verificata la riapertura offline della
  PWA con dati persistiti sia su OPFS sia su IndexedDB.
- Aggiunta la prima dashboard collegata al ledger con patrimonio EUR, entrate, spese,
  saldo dei flussi e riepilogo conti.
- Aggiunta la lista responsive dei movimenti recenti, con trasferimenti collassati in
  una sola attività neutrale e annullamenti visibili ma esclusi dai saldi.
- Aggiunti `FinancialAmount` e `MetricCard`, con formattazione locale esatta degli
  importi `bigint` senza conversione floating point.
- Verificata la dashboard sintetica con accessibilità automatica e assenza di overflow
  a 320, 768 e 1440 px.
- Aggiunta la pagina Conti con creazione, modifica, archiviazione e riattivazione
  persistenti su SQLite/OPFS e IndexedDB.
- Aggiunta la conversione esatta dell'input monetario localizzato in minor units
  `bigint`, senza passaggi floating point.
- Protetti saldo iniziale e gerarchia dei sottoconti: nessuna modifica retroattiva
  dopo il primo movimento e nessun sottoconto attivo sotto un padre archiviato.
- Aggiunta la navigazione hash Panoramica/Conti, con layout tabella-editor responsive
  e baseline visuali desktop.
- Verificata la persistenza offline di un conto creato dall'interfaccia su entrambi i
  backend browser.

## [0.4.0] - 2026-07-27

- Completata la Milestone 1 con Money, LocalDate, Account, Category, Transaction e Transfer.
- Formalizzata la convenzione signed senza uso di floating point binario.
- Aggiunti report di saldo e income/expense che escludono i trasferimenti interni.
- Aggiunto repository in-memory con riferimenti validati e commit atomico dei trasferimenti.
- Aggiunti test per precisione, segni, valute, fee, annullamenti, saldi e rollback logico.

## [0.3.0] - 2026-07-27

- Completata la Milestone 0 con monorepo pnpm e TypeScript strict.
- Aggiunta PWA React/Vite installabile con shell e risorse disponibili offline.
- Implementati design token, navigazione responsive, error boundary e logging sicuro.
- Aggiunti format, lint, typecheck, unit test, test accessibilità ed E2E a 320/768/1440 px.
- Resa la CI riproducibile tramite lockfile e quality gate reali.
- Sostituiti i dati contestuali nell'esempio di importazione con fixture sintetiche.

## [0.2.0]

- Creato pacchetto iniziale Codex-ready per Nexora.
- Aggiunto requisito prioritario di migrazione Money Manager XLSX.
- Integrato il mockup ufficiale Nexora con immagine, prototipo HTML e design system.
- Aggiunte istruzioni, skill e prompt Codex per trasformare il mockup in UI responsive e accessibile.

## 12.5.C4.4 — Categorie, sottocategorie, tag, ricerca globale e diario — 2026-09-04

- Implementata la classificazione completa con categoria padre/figlio, tag persistiti nel dettaglio
  movimento, ricerca per descrizione, controparte, categoria, tag e conto, e diario mensile con
  modifica idempotente e controllo 4/5. I duplicati di categoria sono rifiutati senza scritture
  parziali in InMemory, SQLite e IndexedDB.
- Nuovo E2E `test/e2e/c4-classification-search-journal-flow.spec.ts`: ciclo finanziario `1.000,00`
  EUR → `920,00` EUR, spesa `80,00` EUR, netto `-80,00` EUR; merge categoria/tag, archiviazione e
  riattivazione, ricerca globale, dialoghi di annullamento, reload/reopen e scenario IndexedDB offline.
- Suite mirate: web/domain `22 passed`; repository SQLite/IndexedDB `80 passed`. E2E C4.4: profili
  chromium-390 e chromium-1440 `2 passed / 1 skipped` ciascuno. Suite completa Vitest: `622 passed`,
  `4 skipped`; lint, typecheck e build verdi.

## 12.5.C4.4-R — Chiusura coperture e riconciliazione — 2026-09-04

- Corretto il commit atomico IndexedDB offline evitando la chiusura prematura delle transazioni;
  una macro con figli attivi non può più essere archiviata dalla UI.
- Aggiunte coperture E2E per diario (periodo invalido, double-submit, annulla edit), riferimenti
  storici dopo merge/archiviazione, ricerca di elementi archiviati, reload offline e riconciliazione
  online senza duplicati su 320/375/390/768/1024/1440 px con zoom CDP 200% su desktop.

## Unreleased

- C4.5: certificato il flusso UI di ricorrenza stipendio, proposta allocazioni, budget e notifiche;
  le conferme manuali mantengono la data contabile dello stipendio e l'idempotenza dei trasferimenti.

# Unreleased

- Added strict ROADMAP AUTOPILOT orchestration with deterministic next-task resolution, hard advancement checks, full-gate finalization, and verified commit/push requirements.
