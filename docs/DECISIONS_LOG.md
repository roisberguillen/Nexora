# Decision Log

Registrare qui ogni decisione non coperta dagli ADR con data, contesto, scelta e conseguenze.

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
