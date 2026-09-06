# Nexora C5 — Framework di coerenza cross-surface

## Scopo

La C5 verifica che superfici già chiuse singolarmente in C3 e attraversate nei flussi C4
condividano struttura, terminologia, CTA, form, stati, rappresentazione finanziaria e token.
Non introduce feature, nuove route o un redesign. C5.0 produce il framework, la fotografia
iniziale e la decomposizione delle slice successive.

Fonti: `docs/ux/MOCKUP_INTEGRATION.md`, `docs/ux/STITCH_UI_REFERENCE.md`,
`docs/ux/STITCH_SCREEN_MATRIX.md`, `docs/ROADMAP_UI_ARCHITECTURE.md`, matrici C3/C4 e codice
condiviso in `packages/ui`.

## Unità di rilievo

Ogni rilievo ha un ID stabile nella matrice `.codex/state/c5-consistency-matrix.md` e segue il
ciclo `OPEN → PLANNED → IN_PROGRESS → VERIFIED → CLOSED` oppure `ACCEPTED` quando la differenza
è intenzionale e documentata. Un rilievo non può essere chiuso dalla sola ispezione del codice:
serve evidence browser della coppia di superfici e il test indicato dalla matrice.

Campi obbligatori: ID, superficie A, superficie B/riferimento condiviso, categoria, viewport,
comportamento attuale, atteso, evidence browser, severità P0/P1/P2, correzione richiesta, test,
stato ed evidence finale.

## Contratto di audit

- Navigazione: sidebar desktop, bottom navigation mobile, header, page header, route attiva,
  quick action, drawer/sheet, dialog, back navigation e breadcrumb quando previsto.
- Linguaggio: stesso concetto finanziario con lo stesso nome, salvo differenza motivata dal
  contesto. In particolare Conti, Movimenti, Entrata, Uscita, Trasferimento, Budget,
  Ricorrenze, Allocazioni, Prestiti, Investimenti, Categorie, Tag, Importa, Esporta, Backup,
  Ripristina, Notifiche, Impostazioni e Sicurezza.
- Azioni e form: verbo, gerarchia, label, placeholder, required, errore, focus, disabled,
  loading e protezione dal doppio invio.
- Stati: loading, vuoto, errore, offline, successo, warning, toast, dialog, conferma distruttiva
  e retry.
- Finanza: `FinancialAmount`, minor units/`bigint`, EUR e `it-IT`, segni, allineamento, saldi,
  patrimonio, budget progress e trasferimenti neutrali. C5 non modifica invarianti.
- Design system: riuso di componenti e token, assenza di CSS/icone duplicate e coerenza di
  raggi, spaziature, tipografia e pulsanti equivalenti.

## Evidence browser

L’audit C5.0 usa l’app reale con dati sintetici o stato vuoto controllato, route hash reali e
console senza errori rilevanti. I viewport verificati sono 320, 375, 390, 768, 1024 e 1440 CSS
px; l’assenza di overflow è stata rilevata con `scrollWidth/clientWidth`. Il controllo 390 px
ha prodotto uno screenshot della superficie `#transactions` che mostra il wrapping dell’icona
notifiche nel `MobileHeader`. Il percorso di zoom 200% resta requisito di chiusura per le slice
che toccano form/dialog e non viene dichiarato superato da C5.0.

I riferimenti inizialmente richiesti sotto `design/mockup/stitch/` non esistono in quella cartella;
sono presenti nella posizione autorevole `docs/ux/`. Il gap di percorso è registrato nella review
C5.0 e non altera il mockup ufficiale.

## Severità e chiusura

- **P0**: rischio dati/sicurezza, risultato finanziario errato o flusso fondamentale impossibile.
- **P1**: funzione importante inutilizzabile, persistenza incoerente, errore non recuperabile,
  CTA/focus che impedisce il flusso o overflow critico.
- **P2**: incoerenza minore di naming, icona, allineamento o pattern che non altera dati o uso.

Una slice successiva può chiudere solo i rilievi nel proprio scope con browser evidence, test
regressivi, gate di qualità e riconciliazione della matrice. C5.0 non chiude le slice C5.x.

## Decomposizione approvata

1. **12.5.C5.1** — Navigation, header, page chrome, CTA e terminologia.
2. **12.5.C5.2** — Form, dialog, feedback e system states.
3. **12.5.C5.3** — Componenti finanziari e rappresentazione dati.
4. **12.5.C5.4** — Responsive cross-surface consistency.
5. **12.5.C5.5** — Rifinitura trasversale e regressioni.
6. **12.5.C5-F** — Final consistency gate.

## Convenzione CTA C5.1

- `Nuovo …` apre un editor vuoto dalla superficie elenco.
- `Crea …` conferma la prima persistenza di una nuova entità.
- `Aggiungi …` è riservato ad azioni relazionali o a dati predefiniti, come aggiungere una
  sottocategoria o la tassonomia iniziale.
- `Salva …` conferma la creazione quando il nome dell’entità è utile nel pulsante; `Salva
  modifiche` è il nome comune per aggiornare un’entità esistente.
- `Elimina`, `Archivia`, `Annulla` e `Ripristina` restano verbi distinti perché rappresentano
  effetti diversi sul ledger o sul ciclo di vita dell’entità.
