# Integrazione del mockup Nexora

## Ruolo del mockup

Il mockup in `design/mockup/stitch/` è il riferimento visivo principale per l'interfaccia desktop di Nexora. Deve guidare struttura, gerarchia, densità, navigazione, palette, tipografia e componenti, senza sostituire i requisiti funzionali del PRD, le regole del dominio o i requisiti di accessibilità.

## File disponibili

- `design/mockup/stitch/screen.png`: riferimento visivo statico.
- `design/mockup/stitch/code.html`: prototipo HTML generato dal mockup.
- `design/mockup/stitch/DESIGN.md`: token, principi grafici, layout e componenti.

## Priorità delle fonti

In caso di conflitto, applicare questo ordine:

1. invarianti finanziari e sicurezza;
2. PRD e criteri di accettazione;
3. accessibilità e comportamento responsive;
4. flussi UX documentati;
5. mockup e design system;
6. dettagli cosmetici del prototipo HTML.

Il prototipo non autorizza a introdurre dati, feature o logiche non presenti nel PRD.

## Obiettivi di implementazione

- Riprodurre la personalità visiva Corporate / Modern di Nexora.
- Usare una navigazione desktop persistente e collassabile.
- Mantenere una superficie centrale fluida e leggibile.
- Esporre metriche finanziarie primarie prima dei dettagli.
- Utilizzare tabelle dense ma accessibili per transazioni e importazioni.
- Conservare allineamento a destra e formattazione locale `it-IT` per importi.
- Adattare la stessa gerarchia a tablet e mobile, senza forzare il layout desktop.
- Supportare modalità chiara e, se introdotta, modalità scura tramite token semantici.

## Regole per Codex

- Non copiare ciecamente il markup di `code.html`; estrarre pattern e ricostruirli con i componenti del progetto.
- Non aggiungere dipendenze solo perché presenti nel prototipo.
- Convertire colori e misure in design token centralizzati nel package UI.
- Creare componenti riutilizzabili e non una singola pagina monolitica.
- Usare dati fittizi esclusivamente sintetici.
- Verificare contrasto, focus, tastiera, zoom 200% e viewport da 320 px.
- Fornire stati loading, vuoto, errore, offline e dati parziali.
- Tutti i grafici devono avere descrizione testuale e valori accessibili.

## Componenti suggeriti

- `AppShell`
- `SidebarNavigation`
- `TopHeader`
- `GlobalSearch`
- `MetricCard`
- `FinancialAmount`
- `TrendIndicator`
- `DataCard`
- `TransactionTable`
- `AccountSummary`
- `BudgetProgress`
- `NotificationCenter`
- `ContextPanel`
- `ImportWizard`

## Processo di implementazione

1. Analizzare `screen.png`, `DESIGN.md` e `code.html`.
2. Inventariare layout, componenti, token e stati.
3. Tradurre il design system in token TypeScript/CSS.
4. Implementare l'App Shell responsive.
5. Implementare la dashboard con dati sintetici.
6. Confrontare screenshot desktop con il mockup.
7. Correggere scostamenti significativi senza sacrificare accessibilità.
8. Documentare divergenze intenzionali nel decision log.

## Criteri di accettazione

- Il desktop richiama chiaramente il mockup per struttura e gerarchia.
- Il layout non presenta overflow a 320, 768, 1024 e 1440 px.
- Navigazione, ricerca e azioni principali sono utilizzabili da tastiera.
- I token visivi sono centralizzati e non duplicati arbitrariamente.
- Il codice del prototipo resta materiale di riferimento e non è servito direttamente in produzione.
- Gli screenshot di regressione sono salvati nei test visuali quando l'infrastruttura sarà disponibile.
