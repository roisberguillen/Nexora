# UI/UX screen review — Nexora checklist v2

Manifest: nexora-ui-ux-mobile-desktop/v2
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Movimenti mobile e filtro sheet
Route: #transactions
Task/Fase: 12.5.C2.7 — Mobile Banking UX Movimenti
Branch: codex/phase-12-5-0-checkpoint
Data: 2026-08-24
Revisore: Codex — Nexora UI/QA
Flusso principale: apertura Movimenti → ricerca/clear → filtro sheet → applicazione o Escape → lista/dettaglio → nuovo movimento
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom; keyboard; touch >=44 px
Esito: UI_REVIEW_INCOMPLETE

## Universale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Comprensione in pochi secondi e gerarchia primaria/secondaria | PASS | E2E conferma titolo, ricerca, filtri, lista e CTA in ordine leggibile. |
| U-02 | CTA riconoscibile, azioni distruttive distinguibili e terminologia finanziaria coerente | PASS | Nuovo movimento resta primario; azioni cestino restano nel menu contestuale. |
| U-03 | Flusso, route, view model reali e feedback portano al risultato previsto | PASS | Smoke Movimenti 60/60 usa route e view model reali, senza mock finanziari. |
| U-04 | Nessuna logica finanziaria impropria nella UI; nessun elemento duplicato o inutile | PASS | Modifica limitata a presentazione e filtri; command e Money invariati. |
| U-05 | Overflow, troncamenti, focus, touch target e doppio submit controllati | PASS | Smoke verifica overflow; controlli nuovi hanno almeno 44 px e focus return. |

## Mobile

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px: nessun overflow, taglio o CTA irraggiungibile | PASS | E2E chromium-320 passa lista, filtro sheet, form e controllo scrollWidth. |
| M-02 | 375 px: controlli, form, toolbar e spaziatura sono utilizzabili | PASS | E2E chromium-375 passa flussi Movimenti e filtro sheet. |
| M-03 | 390 px: esperienza completa, card/lista e gerarchia sono leggibili | PASS | E2E chromium-390 passa lista, trasferimento, filtri e stati. |
| M-04 | Navigazione inferiore, safe area e overlay non coprono il contenuto | PASS | Sheet usa safe-area inset bottom e pagina mantiene padding mobile. |
| M-05 | Touch target >=44x44 px e azioni frequenti raggiungibili con una mano | PASS | Clear, filtri, quick filter e CTA usano min-height 2.75rem. |
| M-06 | Nessuna funzione dipende dal solo hover; Indietro/Annulla è prevedibile | PASS | Azioni sono button tastiera; Escape chiude sheet e ripristina focus. |
| M-07 | Keyboard/date/select non nascondono la CTA e non perdono dati | PASS | Form esistente e sheet sono coperti da smoke responsive e focus trap. |
| M-08 | Importi, descrizioni lunghe e testi monetari non si spezzano impropriamente | PASS | Lista mantiene importi nowrap e testi secondari ellissi/overflow-wrap. |
| M-09 | La soluzione è mobile-first, non Desktop compresso; variante card/drawer/sheet se necessaria | PASS | Filtri diventano bottom sheet; quick filters diventano scorribili a 320 px. |

## Tablet

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px portrait: layout, pannelli e contenuti sono completi | PASS | E2E chromium-768 passa lista, dettaglio, form e filtri. |
| T-02 | 768–1023 px: ridimensionamento progressivo senza sovrapposizioni | PASS | Smoke 768 e 1024 passa senza overflow o sovrapposizioni. |
| T-03 | Colonne, form e tabelle restano sostenibili al touch | PASS | Lista e pannelli mantengono min-height e griglie responsive. |
| T-04 | Transizione navigazione mobile/desktop non nasconde funzioni | PASS | E2E passa sia viewport tablet sia desktop sulla stessa route. |

## Desktop

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px: desktop compatto senza testi troncati o colonne inutilizzabili | PASS | E2E chromium-1024 passa lista, filtri, trasferimento e overflow. |
| D-02 | 1440 px: spazio, densità, sidebar e top bar seguono il riferimento | PASS | E2E chromium-1440 passa smoke Movimenti e axe nei flussi esistenti. |
| D-03 | Tabelle, pannelli, ricerca, filtri e importi sono allineati e leggibili | PASS | Ricerca, filtri, lista e importi usano componenti/token esistenti. |
| D-04 | Hover ha alternativa; focus, selected, pressed e disabled sono visibili | PASS | Menu e controlli sono azionabili da tastiera e mantengono stati semantici. |
| D-05 | Azioni contestuali e pannelli non si sovrappongono né usano spazio ambiguo | PASS | Dettaglio resta pannello desktop e sheet è limitato ai viewport mobili. |
| D-06 | Layout desktop non è una versione mobile semplicemente allargata | PASS | Modifica CSS è confinata alla media query mobile; desktop invariato. |

## Visuale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Gerarchia, densità e spaziature seguono mockup e token Nexora | PASS | Sono riusati token e gerarchia Movimenti esistente; nessun markup Stitch copiato. |
| V-02 | Colori, font, radius e icone sono approvati e non duplicati localmente | PASS | CSS usa variabili Nexora e NavIcon/FinancialAmount esistenti. |
| V-03 | Primitive condivise e design system sono riusati senza copiare markup Stitch | PASS | AccessibleDialog, FinancialAmount e componenti lista restano condivisi. |
| V-04 | Stati visivi e semantici sono coerenti con il riferimento ufficiale | PASS | Empty, search-empty, feedback, sheet e selected mantengono copy semantico. |
| V-05 | Contrasto, immagini, asset e allineamento supportano la comprensione | PASS | Axe passa i flussi Movimenti; nessun asset nuovo introdotto. |
| V-06 | Movimento è funzionale, stabile e rispetta reduced motion | N/A | Nessuna animazione o transizione nuova è stata introdotta. |

## Ricerca

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Campo ricercabile e criteri sono riconoscibili | PASS | Label persistente e role searchbox verificati da component/E2E. |
| S-02 | Filtri attivi, rimozione singola e reset sono visibili | PASS | Chip attivi, clear ricerca e Azzera filtri sono coperti dai test. |
| S-03 | Combinazioni di filtri e distinzione filtro/ordinamento sono comprensibili | PASS | Test combina query, Uscite e reset; sort resta separato. |
| S-04 | Stato senza risultati indica contesto e prossima azione | PASS | Empty search/filter esistente comunica modifica o reset dei filtri. |
| S-05 | Stato selected e comportamento mobile sono verificati | PASS | Filter trigger aria-expanded e sheet mobile sono verificati. |
| S-06 | Ricerca, filtri e risultati mantengono privacy e dati reali | PASS | Filtri lavorano sul view model locale già caricato. |
| S-07 | Se assente, la N/A spiega perché la superficie non offre ricerca/filtri | N/A | N/A: la superficie offre ricerca e filtri reali, quindi il controllo non è assente. |

## Form

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Campi, ordine, label e obbligatorietà seguono il flusso naturale | PASS | Smoke copre Entrata, Uscita, Trasferimento e form esistente. |
| F-02 | Form mobile monocolonna con tastiera e input adeguati | PASS | Form mobile resta monocolonna e input amount mantiene inputMode decimal. |
| F-03 | Errori vicino al campo, associati e comprensibili | PASS | Error region esistente resta role alert e non è stata alterata. |
| F-04 | CTA, conferma, annulla ed Escape sono distinti e prevedibili | PASS | Salva/Annulla esistenti e Escape del dettaglio/sheet passano E2E. |
| F-05 | Dialog/drawer/sheet hanno focus trap, ritorno focus e chiusura coerenti | PASS | AccessibleDialog implementa trap, Escape e focus return; test passa. |
| F-06 | Loading, disabled, doppio submit e perdita dati non salvati sono gestiti | PASS | isSaving e disabled del form esistente restano invariati. |
| F-07 | Form e overlay non coprono CTA o contenuto nei viewport obbligatori | PASS | E2E passa il nuovo sheet e i flussi form senza overflow. |
| F-08 | Dati monetari, date, select e maschere preservano semantica e locale | PASS | Nessun contratto form o parsing finanziario è cambiato. |

## Stati

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading comunica cosa sta accadendo senza layout shift evidente | N/A | N/A: la fase non modifica il bootstrap/loading della pagina. |
| B-02 | Empty state spiega contesto e prossima azione | PASS | Empty e search-empty esistenti restano visibili e testati. |
| B-03 | Error state offre messaggio, recupero e retry quando applicabile | PASS | Error region esistente resta presente nei percorsi mutativi. |
| B-04 | Offline e ritorno online preservano contesto e informano l’utente | N/A | Nessun comportamento offline specifico è stato modificato in questa slice. |
| B-05 | Successo, feedback e undo confermano l’azione corretta | PASS | E2E verifica successi di trasferimento, annullamento e cestino. |
| B-06 | Partial data, disabled e conflitti non vengono nascosti | PASS | Stato disabled/loading esistente resta invariato. |

## Accessibilita

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Nomi accessibili, label icone, semantica e landmark sono corretti | PASS | Axe e locator role/label passano nei flussi Movimenti. |
| A-02 | Keyboard-only path completo, ordine focus e focus visibile | PASS | Component test ed E2E verificano Escape e focus return del sheet. |
| A-03 | Contrasto testo >=4.5:1 e UI >=3:1; colore non unico segnale | PASS | Axe passa; stati includono label e testo oltre al colore. |
| A-04 | Zoom browser 200% mantiene contenuto e azioni utilizzabili | PASS | Chromium headed controllato con CDP `Emulation.setDeviceMetricsOverride`: viewport fisico 1024/1440, CSS viewport 512/720, `deviceScaleFactor=2` (`devicePixelRatio≈2`). Verificati titolo, ricerca/clear, filtri, reset/applica, Escape/focus return, lista, dettaglio/importo, CTA nuovo movimento, Entrata, Uscita, Trasferimento e overflow: 2/2 contesti verdi. |
| A-05 | Error association, aria-live e messaggi sono annunciabili | PASS | aria-live/role status/alert esistenti restano invariati. |
| A-06 | Grafici e dati complessi hanno alternativa accessibile | N/A | N/A: Movimenti non introduce grafici nella superficie modificata. |
| A-07 | Touch target >=44 px e interazioni non dipendono da hover | PASS | Clear, Filtri, quick filters e CTA hanno min-height 2.75rem. |
| A-08 | Reduced motion non elimina informazione o funzionalita | N/A | Nessun movimento nuovo è stato introdotto. |
| A-09 | Focus, dialog, sheet e navigazione rispettano WCAG 2.2 AA di base | PASS | AccessibleDialog e axe sono coperti dal test responsive 60/60. |

## Finanza

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Entrata, uscita e trasferimento sono distinti senza ambiguita | PASS | E2E verifica i tre flussi e la lista bancaria. |
| N-02 | Trasferimento mostrato come una sola operazione ed escluso dai KPI quando previsto | PASS | View model e KPI non sono stati modificati; transfer resta aggregato. |
| N-03 | Segno, unita, periodo, conto, categoria e stato sono corretti | PASS | FinancialAmount e view model esistenti sono riusati. |
| N-04 | Importi e aggregati sono riconducibili ai dettagli visualizzati | PASS | Nessun calcolo o aggregato è stato duplicato nella UI mobile. |
| N-05 | Money/minor units e precisione non vengono alterati dalla UI | PASS | Nessuna modifica a Money, parser, command o repository. |
| N-06 | Import richiede anteprima e conferma; azioni distruttive sono protette | N/A | N/A: import non rientra nella superficie Movimenti modificata. |
| N-07 | Locale it-IT, EUR, date ISO e Europe/Rome sono rispettati | PASS | Date e importi restano nei componenti e formatter esistenti. |
| N-08 | Problemi dominio sono inoltrati, non corretti arbitrariamente nella UI | PASS | C2.6 transfer update resta esplicitamente fuori scope. |

## Performance

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Interazioni comuni rispondono e il primo contenuto utile è prioritario | PASS | Smoke apre ricerca, sheet e dettaglio senza attese aggiuntive. |
| Q-02 | Dataset realistici non causano jank o render duplicati evidenti | PASS | Nessuna dipendenza o virtualizzazione nuova; filtri restano locali. |
| Q-03 | Overlay e transizioni aprono in modo stabile | PASS | Sheet/focus trap passano su tutti i progetti E2E. |
| Q-04 | Asset e componenti costosi sono proporzionati al rischio | PASS | Sono stati riusati componenti esistenti, senza asset nuovi. |
| Q-05 | Rete lenta, offline e recupero errori restano comprensibili | N/A | Nessun percorso rete/offline è stato modificato da questa slice. |

## Criticita e decisione

P0 aperti: Nessuno
P1 aperti: `format:check` globale — owner: QA/repository hygiene; chiusura richiesta prima della fase COMPLETE. Zoom 200% risolto in C2.7-F1.
P2 aperti: Nessuno
Test automatici: component Vitest 20/20; lint PASS; typecheck PASS; build PASS; E2E Movimenti 60/60; codex:validate PASS; manifest aggiornato.
Verifica manuale/visuale: browser Chromium 320, 375, 390, 768, 1024, 1440; zoom equivalente reale a 200% su finestra fisica 1024/1440 con CSS viewport 512/720 e `devicePixelRatio≈2`; axe nei flussi esistenti; keyboard Escape/focus return verificati.
Riferimenti: MOCKUP_INTEGRATION, STITCH_UI_REFERENCE, DESIGN.md
