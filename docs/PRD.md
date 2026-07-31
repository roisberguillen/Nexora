# Product Requirements Document — Nexora

## 1. Visione
Nexora è il sistema operativo personale della finanza dell'utente. Deve offrire una visione affidabile del denaro disponibile, dei flussi, dei debiti, degli investimenti e degli obiettivi senza dipendere da connessioni bancarie esterne.

## 2. Obiettivi
- Consolidare tutta la contabilità personale in un solo archivio.
- Migrare integralmente lo storico da Money Manager XLSX.
- Distinguere correttamente spese, entrate e trasferimenti.
- Pianificare risparmio, investimenti e rimborso debiti.
- Rendere i dati disponibili offline e protetti.
- Permettere backup, ripristino ed esportazione senza lock-in.

## 3. Non obiettivi V1
- PSD2/open banking.
- Trading o esecuzione ordini.
- Consulenza finanziaria regolamentata.
- Multiutente collaborativo.
- Gestione completa di beni fisici.

## 4. Moduli funzionali

### 4.1 Onboarding
- Creazione profilo locale.
- Scelta valuta e locale.
- Creazione conti iniziali.
- Wizard prestiti esistenti: saldo residuo oppure rate già pagate.
- Proposta di importazione storica da Money Manager.

### 4.2 Conti
Tipi: checking, savings, cash, investment, loan, virtual subaccount.
N26 deve supportare conto principale e Spaces illimitati.

### 4.3 Transazioni
- Entrata, spesa, trasferimento, rettifica.
- Data operazione, data valuta, importo, conto, controparte, categoria, sottocategoria, tag, note, allegati.
- Split transaction.
- Stato previsto, contabilizzato, riconciliato, annullato.
- Trasferimenti con due gambe collegate e impatto netto zero sul reddito/spesa.

### 4.4 Ricorrenze
- Frequenza, giorno nominale, regole weekend, data prevista, data effettiva.
- Stipendio: giorno 28 con regola sabato→27 e domenica→29.
- Notifica se lo stipendio atteso non è stato registrato.

### 4.5 Budget
- Budget mensili per categoria o gruppo.
- Soglie 80% e 100%.
- Risparmio e trasferimenti esclusi dalla spesa.

### 4.6 Risparmio e allocazioni
- Risparmio mensile pianificato di €170.
- Allocazione tra Spaces N26 configurabile.
- Trasferimento mensile pianificato di €60 verso Directa.
- Alla registrazione dello stipendio: richiesta di conferma “Stipendio ricevuto. Eseguire le allocazioni pianificate?”.
- Entrate fotografiche: proposta percentuale configurabile tra risparmio, investimento e disponibilità discrezionale.

### 4.7 Prestiti
- Findomestic: rata €172/mese.
- Agos: rata €72/mese.
- Importo originario, TAN/TAEG opzionali, rata, capitale residuo, rate pagate e residue, prossima scadenza, progresso.

### 4.8 Investimenti
- Conto Directa.
- Contributi e valore corrente inseribili manualmente o importabili.
- Capitale investito, valore corrente, guadagno/perdita assoluto e percentuale.

### 4.9 Importazione Money Manager XLSX
Requisito prioritario e distinto dagli estratti conto.
- Lettura workbook e selezione foglio.
- Rilevamento intestazioni.
- Mapping colonne assistito e manuale.
- Supporto date Excel seriali e date testuali italiane.
- Riconoscimento conti, categorie, sottocategorie, valuta, note, descrizione e trasferimenti.
- Anteprima normalizzata.
- Convalida riga per riga.
- Deduplicazione tramite fingerprint stabile e confronto fuzzy opzionale.
- Dry-run obbligatorio.
- Importazione atomica.
- Report finale.
- Undo completo per batch.
- Salvataggio profilo mapping.
- Conservazione del valore sorgente e dell'identificativo del batch per audit.

### 4.10 Importazione estratti conto
- Mediobanca XLSX.
- N26 PDF, con parser separato e revisione manuale obbligatoria.
- CSV/XLSX generici tramite mapping.
- Identificazione dei trasferimenti tra conti propri e Spaces.

### 4.11 Esportazione
- CSV, XLSX, JSON.
- PDF report opzionale.
- Export completo e per intervallo/conti/categorie.

### 4.12 Backup e ripristino
- Backup manuale cifrato esportabile e automazione opzionale Google Drive.
- Destinazioni: file `.nexora` scelto dall'utente e Google Drive; NAS, SMB, cartelle di rete e
  backup agent non sono supportati.
- Include database, configurazione e allegati.
- Manifest, checksum, versione schema e verifica integrità.
- Cronologia versioni e test di ripristino.

### 4.13 Dashboard
- Saldi, patrimonio netto, entrate, spese, investimenti, debiti.
- Spese fisse/variabili, categorie principali, budget, scadenze, obiettivi.
- Widget configurabili.

### 4.14 Ricerca globale
Ricerca su transazioni, categorie, conti, prestiti, investimenti, note e allegati.

### 4.15 Centro notifiche
Rata in scadenza, stipendio mancante, budget superato, backup scaduto, ricorrenza pendente, saldo basso.

### 4.16 Diario finanziario
Sintesi narrativa mensile automatica con entrate, risparmio, investimenti, variazioni di spesa, budget e patrimonio netto.

## 5. Requisiti non funzionali
- Offline-first: applicazioni installabili Windows, macOS e Android; PWA browser opzionale e
  separata.
- Integrità contabile e audit trail.
- Prestazioni fluide con almeno 100.000 transazioni.
- Cifratura dei backup.
- Accessibilità WCAG 2.2 AA per i flussi principali.
- Nessuna telemetria finanziaria senza consenso esplicito.
- Ripristino verificabile.

## 6. KPI di qualità
- 100% righe importate contabilizzate come importate, ignorate o in errore.
- Zero duplicati in re-import dello stesso file.
- Zero trasferimenti conteggiati come spese/entrate nei report.
- Saldi ricostruibili dall'audit trail.
- Ripristino backup riuscito nei test automatici.
