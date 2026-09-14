# Roadmap — Menu mobile completo

## Obiettivo

Rendere raggiungibili dal mobile tutte le destinazioni già presenti nella sidebar desktop,
mantenendo invariata la bottom navigation esistente, le sue cinque voci e il pulsante `+` delle
azioni rapide.

La roadmap riguarda esclusivamente discoverability, navigazione e responsive UX. Non introduce
nuove route, dati, comandi finanziari o permessi.

## Stato implementazione — 2026-09-14

`MN-1`–`MN-5` completate: il menu mobile usa la sidebar/catalogo esistente, è richiamabile
dall'header sotto 768 px, mantiene invariata la bottom navigation e gestisce chiusura, focus,
route e gate responsive.

## Baseline verificata

La sidebar desktop espone 18 destinazioni raggruppate per area. La bottom navigation mobile
espone già:

- Panoramica
- Movimenti
- Conti
- Analisi
- Profilo

L'header mobile espone inoltre ricerca globale e Notifiche. Il pulsante `+` conserva le azioni
rapide attuali per nuova operazione, conto, budget, diario, prestito e investimento.

Le destinazioni da rendere disponibili nel menu mobile secondario sono:

- Budget
- Ricorrenze e allocazioni
- Prestiti
- Investimenti
- Diario finanziario
- Categorie
- Tag
- Importa
- Esporta
- Backup
- Impostazioni e cestino
- Privacy e sicurezza

## Decisioni di coerenza

1. La bottom navigation non viene modificata: mantiene cinque elementi, ordine, label, icone,
   route e stato attivo.
2. Il nuovo accesso è un unico menu mobile completo, non una seconda bottom bar e non una copia
   della sidebar desktop sempre visibile.
3. Il menu riusa gli stessi gruppi, label, icone e route della sidebar desktop. La sorgente dei
   dati di navigazione deve essere condivisa per evitare divergenze future.
4. Il menu può essere aperto dall'header mobile con un controllo esplicito `Apri navigazione`;
   il controllo non sostituisce profilo, ricerca o notifiche.
5. Le azioni rapide restano azioni rapide: non vengono trasformate in voci del menu e non vengono
   duplicate senza una necessità di accessibilità o discoverability documentata.
6. Il menu non deve cambiare l'URL, il ledger o lo stato finanziario durante la sola apertura.

## Fasi atomiche

### MN-1 — Contratto di navigazione condiviso

- Estrarre o consolidare il catalogo route/gruppi già usato dalla sidebar.
- Definire una distinzione chiara tra destinazioni di navigazione e azioni rapide.
- Mantenere compatibilità con `NavigationRoute`, `aria-current` e gli hash esistenti.

Evidenza: test del catalogo che garantisce parità tra tutte le destinazioni desktop e menu mobile.

### MN-2 — Trigger nell'header mobile

- Aggiungere un pulsante menu nell'header mobile con nome accessibile e `aria-expanded`.
- Conservare senza variazioni i tre controlli già presenti: profilo, ricerca e notifiche.
- Verificare che l'header resti utilizzabile a 320 px senza clipping o sovrapposizioni.

Evidenza: test component e screenshot/DOM a 320, 375 e 390 px.

### MN-3 — Drawer/sheet del menu completo

- Riutilizzare la struttura gerarchica desktop in un drawer mobile scorrevole.
- Mostrare tutti i gruppi e le 18 destinazioni desktop con route attiva evidenziata.
- Rendere il drawer chiudibile con voce, backdrop ed `Escape`, con focus iniziale, focus trap e
  ritorno del focus al trigger.
- Rispettare safe area, target touch minimo 44×44 px e scroll indipendente dal contenuto.

Evidenza: test keyboard/accessibilità e verifica manuale del percorso verso ogni route.

### MN-4 — Stati e integrazione con le superfici esistenti

- Chiudere il menu dopo la selezione di una route.
- Gestire correttamente `new-transaction` come stato attivo di Movimenti.
- Verificare che apertura menu, cambio route, back/forward e reload non modifichino dati locali.
- Verificare coerenza con Profilo, Impostazioni, Notifiche, ricerca globale e quick action sheet.

Evidenza: regressione E2E mobile con route, browser history e stato attivo.

### MN-5 — Gate responsive e documentazione

- Eseguire test a 320/375/390/768/1024/1440 px.
- Verificare zoom 200% sui viewport desktop e almeno la fruibilità mobile con tastiera/screen
  reader semantics.
- Controllare overflow, console, contrasto, focus visibile e assenza di duplicazione delle CTA.
- Aggiornare evidence UI e changelog solo dopo il completamento verificato della milestone.

Evidenza: `pnpm test:ui-ux`, `pnpm quality:ui-ux`, `pnpm typecheck`, `pnpm codex:validate` e
regressione E2E pertinente verdi.

## Criteri di accettazione

- La bottom navigation mobile è invariata rispetto alla baseline.
- Ogni voce della sidebar desktop è raggiungibile da un punto di navigazione mobile evidente.
- Le 12 voci secondarie sono disponibili nel nuovo menu completo senza route duplicate.
- Profilo, Notifiche, Ricerca globale e azioni rapide mantengono comportamento e posizione.
- Il drawer è utilizzabile a 320 px, non copre il contenuto in modo permanente e rispetta la safe
  area.
- Apertura/chiusura e navigazione sono accessibili da tastiera e non lasciano il focus fuori dal
  drawer quando è aperto.
- Nessun test usa dati finanziari reali e nessuna apertura del menu scrive nel ledger.

## Fuori scope

- Ridisegno della sidebar desktop.
- Modifica dell'ordine o del numero di elementi nella bottom navigation.
- Nuove funzionalità di Budget, Ricorrenze, Import, Export, Backup o Sicurezza.
- Nuove route o cambiamenti al dominio, persistenza, sincronizzazione e autenticazione.
