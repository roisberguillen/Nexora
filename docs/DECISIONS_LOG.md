# Decision Log

Registrare qui ogni decisione non coperta dagli ADR con data, contesto, scelta e conseguenze.

## 2026-08-13 — Import CSV investimento rimosso finché non esiste un batch atomico

- **Contesto:** la pagina Investimenti conteneva un parser CSV locale con split delimitatore,
  assegnazione implicita al primo conto e scritture riga-per-riga. Il framework Import corrente
  audita e annulla esclusivamente batch di movimenti.
- **Scelta:** rimuovere il percorso CSV dalla pagina anziché duplicare parser, mapping, audit e
  rollback. Un eventuale import di posizioni richiederà un'estensione esplicita e transazionale
  del framework Import, con audit e undo cross-entity.
- **Conseguenze:** le posizioni restano modificabili solo dal form manuale verificato; nessun file
  non affidabile viene analizzato, associato a un conto o salvato parzialmente.

## 2026-08-11 — Budget gerarchici e attribuzione degli split

- **Contesto:** i budget devono restare leggibili con la tassonomia Macro → Sottocategoria e
  attribuire correttamente un movimento ripartito senza alterare il ledger.
- **Scelta:** un budget su una macro include la macro e tutti i discendenti, anche archiviati nello
  storico; un budget su una sottocategoria resta diretto. Macro e sottocategoria possono coesistere
  nello stesso periodo, mentre è vietato duplicare il medesimo perimetro, incluso quello globale.
  Una transazione split contribuisce esclusivamente con le righe split compatibili e non con la
  madre priva di categoria.
- **Conseguenze:** speso, residuo, percentuale e stato sono calcoli puri in minor units condivisi
  da pagine Budget e notifiche locali. La correzione delle soglie configurabili introduce poi la
  migrazione additiva v18: i nuovi budget non ricevono percentuali implicite, mentre gli avvisi
  legacy attivi sono conservati come 80/100 in SQLite, IndexedDB e snapshot portabili.

## 2026-08-11 — Soglie Budget configurabili

- **Contesto:** i booleani `alertAt80` e `alertAt100` descrivevano soglie fisse e non potevano
  rappresentare la scelta dell'utente.
- **Scelta:** il dominio usa `firstAlertPercentage` e `secondAlertPercentage`; per i nuovi budget
  entrambi sono obbligatori nell'application layer, interi 1–100 e ordinati strettamente. Il mese
  è assegnato dal layer applicativo, non richiesto nel form. La lettura legacy resta tollerante per
  conservare anche vecchi avvisi disattivati.
- **Conseguenze:** una migrazione SQLite additiva v18 materializza le percentuali, IndexedDB legge
  sia record vecchi sia nuovi, e il Centro notifiche produce identificativi deterministici per
  ciascuna soglia senza duplicare il sistema o rieseguire avvisi già riconosciuti.

## 2026-08-08 — Tassonomia finanziaria a due livelli

- **Contesto:** `Category.parentId` esisteva già nel ledger, ma UI e repository non limitavano in
  modo uniforme la profondità o la compatibilità padre/figlio.
- **Scelta:** Nexora espone Macro categoria → Sottocategoria e rifiuta alberi più profondi,
  genitori archiviati e scope incompatibili. `income` può contenere solo `income`, `expense` solo
  `expense`, mentre `both` può contenere entrambi. La tassonomia iniziale è installabile con
  azione esplicita soltanto in un archivio privo di categorie personali; non migra né rinomina
  categorie già usate.
- **Conseguenze:** import, movimenti, budget, ricorrenze, split, export e backup continuano a
  usare lo stesso `categoryId` e lo stesso `parentId`. Fisso/variabile/periodico/straordinario
  restano fuori dal modello categoria; un trasferimento non riceve una categoria investimento.

## 2026-08-08 — Recupero sicuro del blocco app e reset locale

- **Contesto:** il PIN/passphrase del blocco app è verificabile ma non recuperabile per scelta di
  sicurezza. Il precedente flusso non offriva un recupero dalla schermata bloccata e presentava
  nello stesso dialogo la passphrase di backup, il PIN e la frase di conferma, rendendo ambiguo
  quale valore fosse richiesto.
- **Scelta:** il backup prima del reset finanziario resta facoltativo, cifrato e verificato, con
  una nuova passphrase scelta dall'utente soltanto se desidera creare il file. Il reset dei soli
  dati finanziari richiede ancora il PIN quando il blocco app è attivo. Chi non lo ricorda può
  raggiungere il ripristino totale dalla schermata bloccata o dalle Impostazioni, protetto dalla
  frase `RIPRISTINA NEXORA` e disponibile solo dopo l'apertura del ledger.
- **Conseguenze:** nessuna passphrase viene recuperata, salvata o aggirata. Il ripristino totale
  elimina in modo esplicito tutti i dati locali e il blocco app; non elimina né autorizza la
  cancellazione dei backup Google Drive.

## 2026-08-08 — Ponte OAuth isolato per il consenso Google Drive

- **Contesto:** `COOP: same-origin` protegge l'isolamento richiesto da SQLite/OPFS, ma Chrome può
  interrompere la comunicazione diretta del popup Google dopo il consenso. Allentare il COOP della
  shell ha reso `crossOriginIsolated` falso e non è quindi compatibile con il ledger.
- **Scelta:** mantenere `same-origin` sulla PWA e usare soltanto una pagina OAuth statica separata
  con `same-origin-allow-popups`. La pagina richiede un secondo clic esplicito, comunica il token
  volatile su un `BroadcastChannel` vincolato a nonce e non accede mai al ledger.
- **Conseguenze:** il ritorno OAuth non dipende dall'opener cross-origin, OPFS resta disponibile e
  token, account e dati finanziari non vengono persistiti o registrati. Il deployment deve servire
  l'eccezione di header della route del bridge.

## 2026-08-02 — Onboarding Google opzionale dopo l'apertura del ledger

- **Contesto:** ogni utente deve poter collegare il proprio account Google all'accesso, senza
  trasformare un backup opzionale in un requisito per aprire Nexora o i dati offline.
- **Scelta:** mostrare l'onboarding soltanto dopo l'apertura verificata del ledger e avviare
  `select_account` esclusivamente dopo il clic dell'utente. “Continua senza Drive” vale per la
  sessione corrente; token e identità OAuth restano in memoria e non sono persistiti.
- **Conseguenze:** Nexora resta offline-first e non perde accesso ai dati se Google è assente o il
  consenso viene negato. Il deployment deve comunque fornire un Client ID Web autorizzato; il
  collaudo reale con un account di test rimane un gate esterno della Fase 11.

## 2026-08-02 — Cartella Google Drive privata a privilegio minimo

- **Contesto:** la roadmap richiede account e cartella selezionati dall'utente, mentre l'ADR 0015
  impone lo scope minimo `drive.appdata`, che non permette di sfogliare cartelle arbitrarie.
- **Scelta:** l'account viene scelto nel consenso Google e la cartella supportata è la directory
  privata Nexora `appDataFolder`. Nessun ampliamento silenzioso dello scope OAuth.
- **Conseguenze:** i backup restano isolati e invisibili alle altre app; una futura selezione di
  cartelle Drive visibili richiederà requisiti espliciti, threat model e nuovo ADR.

## 2026-08-01 — Un solo catalogo migrazioni per SQLite browser e nativo

- **Contesto:** la Fase 7 introduce SQLite nativo con Tauri senza poter creare una seconda
  interpretazione dello schema o perdere compatibilità con i ledger esistenti.
- **Scelta:** adattare il plugin SQL ufficiale alla porta `SqliteDatabase` e riusare integralmente
  `MigrationRunner`, repository, codec e snapshot portabili già verificati; il percorso del file
  nativo è limitato a un URL relativo di proprietà dell'app.
- **Conseguenze:** browser e runtime nativo evolvono con le stesse migrazioni; ogni nuova versione
  dello schema deve superare test su entrambi gli adapter.

## 2026-07-31 — Congelamento roadmap UI e multipiattaforma

- **Contesto:** la nuova roadmap definisce Tauri 2, SQLite nativo, Local Hub Rust, backup
  manuale/Google Drive e il mockup Stitch come direzione definitiva.
- **Scelta:** registrare il mockup tramite checksum e usare i nuovi ADR 0017–0019; non copiare
  HTML Stitch e non introdurre NAS/SMB o backup agent come percorsi alternativi.
- **Conseguenze:** la Fase 1 deve mappare tutte le 98 schermate e ogni implementazione futura
  deve rispettare la nuova matrice piattaforme e la policy backup.

## 2026-07-29 — Preferenze finanziarie non operative nascoste

- **Contesto:** valuta principale, formato data e “Mese finanziario: Gennaio” erano mostrati come
  preferenze statiche senza un contratto di persistenza né una migrazione sicura per dati esistenti.
- **Scelta:** rimuovere i controlli apparenti e dichiarare esplicitamente la policy corrente:
  EUR, formato italiano e mese civile. La futura configurazione richiederà un modello dati e una
  migrazione verificata, non solo una modifica visiva.
- **Conseguenze:** l’interfaccia non promette comportamenti inesistenti; nessun dato v1 viene
  reinterpretato o riscritto dalla pagina Impostazioni.

## 2026-07-29 — Nessun backup-agent Docker nella Release Candidate

- **Contesto:** il Dockerfile pubblicava soltanto un placeholder e non offriva un servizio
  eseguibile, verificabile o incluso nel percorso backup della PWA.
- **Scelta:** rimuovere il Dockerfile dal percorso di release anziché presentare un agente
  inesistente. Backup locale e Google Drive restano i soli flussi supportati e testati.
- **Conseguenze:** un futuro agente NAS/self-hosted richiederà contratto, threat model, test e
  documentazione dedicati prima di essere reintrodotto.

## 2026-07-29 — Cestino transazioni senza cascade impliciti

- **Contesto:** la roadmap di cancellazione richiede recupero, coerenza dei trasferimenti e
  assenza di riferimenti orfani su due backend.
- **Scelta:** usare soft-delete esplicito per le transazioni e trattare un trasferimento come
  bundle atomico; le rimozioni fisiche restano deliberate e non usano `ON DELETE CASCADE`.
- **Conseguenze:** query finanziarie filtrano i record nel cestino; reset e svuotamento usano un
  confine atomico e sono preceduti da backup proposto.

## 2026-07-27 — Toolchain della Milestone 0

- **Contesto:** serviva rendere eseguibile lo scaffold mantenendo un monolite modulare.
- **Scelta:** Node 24, pnpm 11, React/Vite, workspace `web`, `ui`, `config`, `domain`,
  `database` e `importers`; dipendenze bloccate nel lockfile.
- **Conseguenze:** dominio, database e importatori sono package reali ma intenzionalmente
  vuoti fino alle rispettive milestone.

## 2026-07-27 — PWA e risorse offline

- **Contesto:** font e icone remoti del prototipo non sono compatibili con offline-first.
- **Scelta:** font Inter e JetBrains Mono inclusi nel bundle, icone SVG locali e service
  worker generato con precache di shell, CSS, JavaScript, icone e font.
- **Conseguenze:** nessuna risorsa di runtime della shell dipende da CDN o servizi esterni.

## 2026-07-27 — Adattamento responsive del mockup

- **Contesto:** la sidebar fissa del prototipo produce overflow su viewport stretti.
- **Scelta:** sidebar persistente da desktop e drawer controllabile da tastiera sotto
  900 px. Sono stati esclusi profilo personale, piano Pro e funzioni non previste dal PRD.
- **Conseguenze:** la gerarchia visiva resta coerente con il mockup, con comportamento
  verificato a 320, 768 e 1440 px.

## 2026-07-27 — Logging sicuro

- **Contesto:** errori e log non devono contenere dati finanziari o identificativi.
- **Scelta:** eventi e metadati sono whitelist TypeScript; i messaggi e gli stack degli
  errori non vengono inoltrati al sink strutturato.
- **Conseguenze:** nuovi eventi richiedono un'estensione esplicita del contratto di logging.

## 2026-07-27 — Override di sicurezza transitivo

- **Contesto:** Workbox risolveva indirettamente `brace-expansion` 5.0.7, interessato
  da un advisory DoS di severità alta.
- **Scelta:** aggiornamento transitivo di `filelist` alla major compatibile con
  `minimatch` 10 e override dei consumer `minimatch` 10 verso `brace-expansion` 5.0.8.
- **Conseguenze:** l'eccezione alla minimum release age è esplicita e limitata alla
  patch di sicurezza; `pnpm audit --audit-level=high` deve restare verde.

## 2026-07-27 — Confine multivaluta della Milestone 1

- **Contesto:** il modello concettuale prevede un exchange rate, ma non definisce ancora
  valuta base, arrotondamento o precisione Decimal.
- **Scelta:** accettare nella Milestone 1 soltanto trasferimenti nella stessa valuta.
- **Conseguenze:** nessun cambio implicito o calcolo finanziario ambiguo; il multivaluta
  richiederà un ADR prima dell'implementazione.

## 2026-07-27 — Perimetro dello schema SQLite v1

- **Contesto:** il modello concettuale comprende moduli pianificati per milestone
  successive, mentre la prima fase di persistenza deve servire il dominio già testato.
- **Scelta:** includere nella migrazione iniziale soltanto conti, categorie, transazioni,
  trasferimenti e storico dello schema; gli altri moduli avranno migrazioni dedicate.
- **Conseguenze:** lo schema non anticipa contratti ancora instabili e gli adapter della
  Milestone 2 possono essere sviluppati contro una base piccola e verificabile.

## 2026-07-27 — Migrazioni forward-only all'avvio

- **Contesto:** i percorsi `down` sono necessari per test e recovery, ma un downgrade
  automatico può distruggere dati prodotti da una versione più recente dell'app.
- **Scelta:** il runner applica solo migrazioni forward e rifiuta versioni sconosciute;
  i rollback restano operazioni di recovery controllate.
- **Conseguenze:** un'app meno recente non tenta di modificare un database più nuovo e
  richiede aggiornamento o ripristino esplicito.

## 2026-07-27 — Worker applicativo per SQLite OPFS

- **Contesto:** SQLite OPFS richiede un worker, mentre le API Worker1/Promiser ufficiali
  sono deprecate.
- **Scelta:** usare direttamente l'API OO1 ufficiale dentro un worker Nexora con
  protocollo minimo e tipizzato.
- **Conseguenze:** il protocollo espone soltanto apertura, esecuzione, query, scrittura e
  chiusura; nuove capacità dovranno essere aggiunte esplicitamente e testate.

## 2026-07-27 — Confine del fallback IndexedDB

- **Contesto:** un fallback generico su qualsiasi errore OPFS può presentare un ledger
  IndexedDB vuoto al posto di dati OPFS temporaneamente inaccessibili.
- **Scelta:** attivare IndexedDB soltanto quando i prerequisiti OPFS mancano o viene
  restituito `opfs_unavailable`; propagare tutti gli altri errori.
- **Conseguenze:** i guasti non vengono nascosti e la futura integrazione PWA dovrà
  mantenere stabile il backend scelto fino a una migrazione esplicita e verificata.

## 2026-07-27 — Attivazione conservativa del seed dimostrativo

- **Contesto:** il requisito richiede dati dimostrativi, ma un seed automatico potrebbe
  contaminare un ledger personale o sovrascrivere entità con identificatori uguali.
- **Scelta:** esporre un'operazione esplicita e idempotente. Il seed è ammesso soltanto
  su un ledger vuoto o su un seed parziale perfettamente compatibile; dati estranei o
  collisioni interrompono l'operazione prima di nuove scritture.
- **Conseguenze:** l'integrazione PWA dovrà richiedere una scelta esplicita dell'utente.
  Un errore tra operazioni può lasciare un sottoinsieme riconoscibile, che una nuova
  esecuzione completa senza duplicati. Trasferimenti e relative gambe restano atomici
  grazie al repository.

## 2026-07-27 — Perimetro del backup locale della Milestone 2

- **Contesto:** il backup completo include in futuro IndexedDB, configurazione,
  allegati, NAS e cloud, mentre il runner delle migrazioni richiede subito una copia
  fisica del database SQLite.
- **Scelta:** completare in Milestone 2 il vertical slice SQLite/OPFS con archivio
  locale cifrato, manifest, doppio checksum e restore verificato. Mantenere esplicito
  il restore e rinviare le altre sorgenti e destinazioni alla Milestone 8.
- **Conseguenze:** le migrazioni SQLite possono ricevere una ricevuta fisica reale; il
  fallback IndexedDB non viene presentato come coperto da questo formato.

## 2026-07-27 — Selezione stabile del backend nella PWA

- **Contesto:** rieseguire la selezione OPFS→IndexedDB a ogni avvio potrebbe mostrare
  un archivio diverso quando cambiano i requisiti del browser.
- **Scelta:** memorizzare soltanto `opfs` o `indexeddb` dopo la prima apertura riuscita
  e forzare quella scelta nelle sessioni successive. Preferenze invalide o
  indisponibili interrompono l'apertura senza fallback.
- **Conseguenze:** la PWA rende visibile il problema invece di presentare un ledger
  apparentemente vuoto. Il seed sintetico resta un'azione esplicita su archivio vuoto.

## 2026-07-27 — Perimetro della prima dashboard

- **Contesto:** il PRD richiede metriche periodiche e multivaluta, ma filtri temporali,
  tassi di cambio e valuta di report non sono ancora definiti.
- **Scelta:** mostrare totali su tutto lo storico disponibile nella valuta principale
  EUR. I conti in altre valute restano visibili ma sono esclusi dal patrimonio senza
  conversione implicita. I conti archiviati restano visibili e inclusi, così nessun
  saldo scompare dal quadro finanziario.
- **Conseguenze:** le etichette dichiarano esplicitamente “totale registrato”; filtri
  mensili e conversioni richiederanno requisiti e ADR dedicati. Nella lista recente le
  gambe di ogni trasferimento vengono collassate in una sola attività neutrale.

## 2026-07-27 — Adattamento dashboard del mockup

- **Contesto:** il mockup ufficiale rappresenta una pagina desktop di costi ricorrenti,
  non la dashboard prevista dalla prima slice.
- **Scelta:** riusare gerarchia, metric card, pannelli tonali, tabella densa e layout
  principale/contesto senza copiare contenuti, profilo personale o previsioni non
  ancora previste.
- **Conseguenze:** il desktop conserva la personalità Corporate / Modern; sotto 768 px
  la tabella diventa una sequenza di record etichettati per evitare overflow.

## 2026-07-28 — Mutabilità conservativa dei conti

- **Contesto:** il PRD richiede la gestione dei conti ma non definisce quali campi
  possano cambiare dopo la registrazione di movimenti.
- **Scelta:** rendere modificabili nome e istituto in ogni momento; consentire la
  correzione del saldo iniziale solo prima del primo movimento. Tipo, valuta e conto
  padre restano immutabili. L'archiviazione è reversibile, non elimina dati e rispetta
  la gerarchia padre-sottoconto.
- **Conseguenze:** saldi e riferimenti storici non vengono reinterpretati
  retroattivamente. Una correzione successiva del saldo richiederà una transazione di
  rettifica nella prossima slice dei movimenti.

## 2026-07-28 — Layout della gestione conti

- **Contesto:** il mockup ufficiale privilegia un workspace principale con pannello
  contestuale, mentre il flusso conti deve funzionare anche su mobile.
- **Scelta:** usare una tabella densa e un editor laterale su desktop; sotto 768 px la
  tabella diventa una sequenza di record etichettati e l'editor si impila nel flusso.
- **Conseguenze:** creazione e modifica condividono lo stesso modulo, restano
  utilizzabili da tastiera e non introducono un dialogo modale o overflow di pagina.

## 2026-07-28 — Perimetro iniziale della gestione movimenti

- **Contesto:** il PRD richiede movimenti, trasferimenti, rettifiche e split, ma lo
  schema v1 non ha ancora un modello persistente per collegare righe di ripartizione.
- **Scelta:** completare prima un vertical slice affidabile per registrazioni manuali,
  trasferimenti nella stessa valuta e annullamento conservativo. Rinviare gli split a
  una migrazione dedicata, invece di memorizzarli come testo o creare somme parziali
  non verificabili.
- **Conseguenze:** ogni trasferimento resta una coppia atomica di gambe e non entra
  nei report income/expense. Le transazioni riconciliate sono protette; l'interfaccia
  chiede una rettifica per correggerle. Value date, note e allegati restano previsti
  dal dominio e verranno esposti in un'estensione del modulo.

## 2026-07-28 — Ricorrenze come proposte esplicite

- **Contesto:** il PRD definisce date previste e allocazioni legate allo stipendio, ma non
  autorizza scritture automatiche nel ledger.
- **Scelta:** una ricorrenza conserva un template indipendente e calcola soltanto una data
  attesa; la futura UI proporrà la registrazione e richiederà sempre conferma prima di
  creare movimenti o trasferimenti. La policy `salary_italy` applica 28 sabato→27 e
  domenica→29.
- **Conseguenze:** dati pianificati e contabilità effettiva non si confondono; una data
  attesa non entra in saldi o report finché l'utente non conferma un movimento.
# 2026-07-31 — Fase 1: la mappa Stitch non crea route nuove

## 2026-08-15 — Undo degli Spaces creati dall'import N26 conserva l'audit

- **Contesto:** le transazioni importate, anche se annullate, restano nel ledger e nell'audit del
  batch con riferimenti al conto. L'eliminazione fisica di uno Space dopo l'undo romperebbe le
  foreign key oppure richiederebbe la cancellazione dell'audit.
- **Scelta:** l'undo di un batch N26 archivia uno Space creato esclusivamente dal batch quando non
  riceve altri utilizzi; non lo elimina fisicamente e non lo riattiva mai in modo implicito.
- **Conseguenze:** transazioni e batch restano verificabili, mentre lo Space non viene più proposto
  per nuove registrazioni. Un utilizzo successivo conserva lo Space attivo e viene riportato.

Le 98 schermate Stitch sono trattate come stati e superfici di una stessa applicazione, non come
98 route da implementare. Ogni schermata è mappata a una route, alle letture/scritture del ledger,
ai componenti e alla fase responsabile in `docs/ux/STITCH_SCREEN_MATRIX.md`. In particolare le
allocazioni restano nella superficie ricorrenze finché una route distinta non sia giustificata dal
flusso mobile; backup e recovery non recuperano alcun percorso NAS/SMB.

## 2026-08-08 — Tassonomia finanziaria a due livelli

- **Contesto:** le categorie precedenti erano piatte, mentre la Fase 12.1 richiede una
  classificazione leggibile senza alterare movimenti o categorie già salvati.
- **Scelta:** rendere esplicito il solo livello `Macro categoria → Sottocategoria`, con
  compatibilità di ambito (`income`, `expense`, `both`) verificata dai repository SQLite,
  IndexedDB e in memoria. La tassonomia iniziale è installata solo su azione dell'utente e
  riprende in modo idempotente un'installazione eventualmente interrotta; non viene applicata
  automaticamente ai dati esistenti.
- **Conseguenze:** non serve una migrazione perché `categories.parent_id` e il relativo indice
  esistono già nello schema. Le categorie archiviate rimangono nello storico e non nelle nuove
  scelte; gli attributi temporali o di natura della spesa restano un modello separato della Fase
  12.2.

## 2026-08-08 — Natura della spesa e ricorrenze non si sovrappongono

- **Contesto:** una categoria economica non indica automaticamente se una spesa sia fissa,
  variabile, ordinaria o straordinaria; una ricorrenza definisce invece una pianificazione.
- **Scelta:** salvare su `Transaction` solo due attributi facoltativi e solo per `expense`:
  variabilità ed eccezionalità. La pianificazione rimane la sola responsabilità di
  `RecurringRule`; la transazione non riceve un flag ricorrente né un riferimento fragile a una
  regola eliminabile. I dati legacy restano non classificati.
- **Conseguenze:** la migrazione v16 è additiva e i backup portabili preservano i valori. Import,
  categorie e movimenti storici non sono reinterpretati automaticamente. L'estensione a frequenze
  oltre il mensile o a una linea storica regola→movimento richiede una slice e ADR dedicati.

## 2026-07-31 — Ripristino dell'avvio dopo la Fase 6

- **Contesto:** in sviluppo l'app mostrava una pagina bianca con l'errore di Vite React
  “can't detect preamble”, attribuito al primo modulo UI caricato (`NavIcon`). Il preambolo era
  presente nell'HTML trasformato, ma non era una dipendenza esplicita dell'entrypoint e poteva
  non essere inizializzato prima del grafo dei moduli React.
- **Scelta:** importare `@vitejs/plugin-react/preamble` come prima dipendenza di `main.tsx`.
  Rendere inoltre `NavIcon` difensivo rispetto a chiavi sconosciute e mostrare una schermata
  statica di recovery se React non riesce a montare.
- **Conseguenze:** i dati locali e i contratti del ledger restano invariati; un errore di icona o
  bootstrap non genera più una pagina vuota. Il log tecnico non contiene dati finanziari.

## 2026-07-31 — Discovery e verifica del ledger non distruttive

- **Contesto:** la discovery di un browser può restare sospesa su OPFS o `indexedDB.databases()`;
  inoltre `loadAppModels()` era eseguito dopo il completamento del bootstrap e dopo la scrittura
  della preferenza del backend.
- **Scelta:** limitare separatamente le sonde e rappresentare una sonda scaduta come archivio
  `blocked`, senza aprire o creare alcun database. Portare il caricamento dei modelli nella fase
  `VERIFYING_DATA` e salvare `nexora.ledger-storage.v1` solo dopo il suo esito positivo.
- **Conseguenze:** la diagnostica espone codice, fase, categoria tecnica, archivi rilevati e
  backend selezionato, mai record finanziari. Due archivi presenti richiedono sempre una scelta
  esplicita; OPFS può ripiegare su IndexedDB soltanto quando la sua assenza è stata verificata.

## 2026-08-01 — Recupero compatibile della cronologia migrazioni v13

- **Causa reale:** il ledger OPFS esistente riportava la migrazione v13 con il nome storico
  `import-fingerprint-tombstones`, incompatibile con il catalogo corrente
  `import-row-deletion-audit`; l'apertura si interrompeva prima della dashboard.
- **Scelta:** accettare esclusivamente l'alias v13 noto, aggiungere la colonna audit soltanto se
  assente e normalizzare la cronologia nella stessa transazione. Le letture snapshot e i modelli
  UI riportano ora codici per entità e fase, senza serializzare dati finanziari nella diagnostica.
- **Conseguenze:** nessun reset di OPFS/IndexedDB/localStorage; i database con cronologia diversa
  restano in recovery non distruttivo e richiedono intervento esplicito.

## 2026-08-11 — Budget ricorrenti senza copie mensili

- **Scelta:** il periodo salvato è l'inizio di validità e le revisioni hanno una fine esclusiva;
  la lettura risolve il budget del mese richiesto in un servizio di dominio condiviso.
- **Conseguenze:** una modifica futura conserva gli importi e le soglie precedenti, mentre la
  disattivazione mantiene il mese corrente e termina dal successivo. Nessun job o record budget
  viene creato automaticamente a inizio mese.

## 2026-08-12 — Allocazioni confermate idempotenti

- **Contesto:** una conferma può contenere più piani e ogni piano genera un transfer atomico; un
  errore dopo il primo transfer non deve farlo duplicare al retry.
- **Scelta:** usare un identificatore di esecuzione tecnico, salvato nella nota delle due gambe e
  incluso nelle identità deterministiche di transfer e transazioni per ciascun piano. La UI
  conserva lo stesso identificatore dopo un errore potenzialmente parziale e propone un retry
  esplicito; non esiste alcuna allocazione automatica.
- **Conseguenze:** lo storico resta auditabile e backup/restore mantengono i marker. I piani
  disattivati possono continuare a riferire un conto archiviato per leggere la configurazione
  storica; i piani attivi bloccano invece l'archiviazione.
