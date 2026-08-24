# 12.5.C2.9 — Final Transactions Gate

Manifest: nexora-ui-ux-mobile-desktop/v2
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Movimenti — final transactions gate
Route: `#transactions` / `#new-transaction`
Task/Fase: 12.5.C2.9
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-08-24
Revisore: Codex — final gate QA/UI
Flusso principale: ingresso Movimenti → ricerca/filtri → lista/dettaglio → form → salvataggio → feedback → freeze
Viewport applicabili: 320, 375, 390, 768, 1024, 1440 px; 200% zoom; keyboard; touch >=44 px
Esito: UI_REVIEW_PASS

Stato: `TRANSACTIONS_GATE_PASS`
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-08-24
Superficie: `#transactions` / `#new-transaction`

## Funzionalità

| Area | Esito | Evidence |
| --- | --- | --- |
| Lista, grouping e dettaglio | PASS | Component tests e E2E coprono lista bancaria, raggruppamento, importi e dettaglio. |
| Ricerca e clear | PASS | E2E verifica ricerca testuale, clear e ritorno allo stato completo. |
| Filtri | PASS | E2E verifica apertura sheet, combinazione, filtri attivi, applica, reset ed Escape. |
| Entrata / Uscita | PASS | Component ed E2E coprono creazione, modifica, validazione, successo ed error feedback. |
| Trasferimento | PASS | E2E copre origine/destinazione, creazione, annullamento e due gambe collegate. |
| Transfer read-only | PASS | C2.6-R e C2.8 confermano assenza di `updateTransfer` e assenza di falsa modifica. |
| Split e tag | PASS | Test component/E2E verificano split, tag e contratto di update esistente. |
| Azioni | PASS | Annullamento, cestino, restore/purge e dialog di conferma sono verdi. |
| Stati UI | PASS | Loading, empty, filtered-empty, error, offline, success e disabled documentati e verificati. |

## Responsive

| Viewport | Esito |
| ---: | --- |
| 320 px | PASS — E2E completo, nessun overflow, CTA e sheet accessibili |
| 375 px | PASS — E2E completo, nessun overflow, form e filtri utilizzabili |
| 390 px | PASS — E2E completo, lista e navigazione mobile verdi |
| 768 px | PASS — tablet, lista, filtri e form verdi |
| 1024 px | PASS — desktop compatto e pannello dettagli verdi |
| 1440 px | PASS — desktop, densità, toolbar e form verdi |
| Zoom 200% | PASS — evidence C2.7-F1 preservata; C2.8 non ha introdotto layout CSS strutturale |

## Accessibilità

PASS: keyboard Enter/Space/Escape, focus visibile, focus trap e return, accessible names,
heading/landmark structure, form labels, alert/status, dialog semantics, screen-reader basics,
contrasto axe e target touch >=44 px. Axe non segnala violazioni nei flussi E2E Movimenti.

## Invarianti finanziarie

PASS: `Money` e minor units `bigint` restano invariati; formatter ufficiale `it-IT` preservato;
nessun float persistito; trasferimenti atomici con due gambe collegate; trasferimenti esclusi da
Entrate/Uscite; modifica manuale esclusa dai transfer; command layer reale; UI senza scritture
dirette agli adapter.

## Test

- `pnpm doctor`: PASS; OPFS/File System Access richiedono verifica browser prevista, Google Drive
  non configurato e non pertinente alla superficie Movimenti.
- Test mirati Movimenti: 8 file, 38/38 passati, 0 skip.
- E2E Movimenti: 60/60 passati, 10 scenari per ciascun viewport 320/375/390/768/1024/1440.
- `pnpm format:check`: PASS.
- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm test`: 136 file passati, 1 file skipped, 570 test passati, 4 skip documentati.
- `pnpm build`: PASS; resta soltanto l’advisory preesistente sui chunk oltre 500 kB.
- `pnpm manifest:check`: PASS.
- `pnpm codex:validate`: PASS.
- `pnpm verify`: PASS.

## Skip policy

Gli unici 4 skip sono già documentati nella suite globale e non riguardano Movimenti; non sono
nuovi, non nascondono flussi della superficie e non bloccano il gate. Gli scenari E2E Movimenti
non hanno skip.

## C2.3 e severity

Le evidence successive C2.7/C2.8 coprono e verificano la superficie che in precedenza risultava
parziale: lista bancaria, grouping, ricerca/filtri, dettaglio, form, responsive e accessibilità.
Lo stato C2.3 viene quindi riallineato a COMPLETE senza inventare nuovi test.

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno

## Freeze

La superficie Movimenti è congelata dopo 12.5.C2.9. Durante C3/C4/C5 può essere modificata
soltanto per correggere una regressione dimostrata, un P0/P1 scoperto dalla review cross-screen
o una violazione di accessibilità/sicurezza. Il freeze non impedisce correzioni necessarie.

## Conclusione

`TRANSACTIONS_GATE_PASS` — freeze consentito. C2 è completa; il prossimo task è C3.0.

## Universale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| U-01 | Gerarchia | PASS | La superficie finale mantiene lista, dettaglio e form comprensibili. |
| U-02 | CTA | PASS | CTA, azioni distruttive e terminologia sono verificati. |
| U-03 | Flusso | PASS | Flussi reali e feedback passano 38 test e 60 E2E. |
| U-04 | Invarianti | PASS | Nessuna logica finanziaria impropria è stata introdotta. |
| U-05 | Robustezza | PASS | Focus, overflow, touch e doppio submit sono coperti. |

## Mobile

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| M-01 | 320 px | PASS | E2E completo senza overflow o CTA irraggiungibili. |
| M-02 | 375 px | PASS | E2E completo su form, filtri e toolbar. |
| M-03 | 390 px | PASS | E2E completo su lista e navigazione mobile. |
| M-04 | Safe area | PASS | Sheet, bottom navigation e CTA restano raggiungibili. |
| M-05 | Touch | PASS | Target interattivi >=44 px verificati. |
| M-06 | Hover | PASS | Nessun flusso dipende dal solo hover. |
| M-07 | Tastiera | PASS | Form e CTA restano utilizzabili nel layout mobile. |
| M-08 | Testi | PASS | Testi lunghi e importi estremi hanno copertura component. |
| M-09 | Variante | PASS | Lista, dettaglio e sheet usano la variante mobile approvata. |

## Tablet

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| T-01 | 768 px | PASS | E2E verifica layout e pannelli completi. |
| T-02 | Reflow | PASS | Sei viewport passano senza sovrapposizioni. |
| T-03 | Touch | PASS | Controlli e form restano sostenibili al touch. |
| T-04 | Navigazione | PASS | Nessuna funzione è persa nella transizione responsive. |

## Desktop

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| D-01 | 1024 px | PASS | E2E verifica colonne, testi e CTA. |
| D-02 | 1440 px | PASS | E2E verifica densità, toolbar e pannello. |
| D-03 | Dati | PASS | Lista, filtri, dettaglio e importi sono leggibili. |
| D-04 | Stati | PASS | Focus, pressed e disabled hanno alternativa al hover. |
| D-05 | Pannelli | PASS | Menu, sheet e dettaglio non si sovrappongono. |
| D-06 | Layout | PASS | Desktop mantiene la composizione desktop approvata. |

## Visuale

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| V-01 | Gerarchia | PASS | Densità e spaziature restano coerenti con C2.8. |
| V-02 | Token | PASS | Token e primitive Nexora sono riusati. |
| V-03 | Primitive | PASS | Dialog, importi e icone restano condivisi. |
| V-04 | Semantica | PASS | Colore non è l’unico segnale degli stati. |
| V-05 | Contrasto | PASS | Axe passa nei flussi Movimenti. |
| V-06 | Motion | PASS | Nessuna informazione dipende da animazioni. |

## Ricerca

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| S-01 | Search | PASS | Searchbox nominata e label persistente sono presenti. |
| S-02 | Clear/reset | PASS | Clear, chip e reset sono verificati. |
| S-03 | Combinazioni | PASS | Query e filtri combinati passano E2E. |
| S-04 | Empty | PASS | Filtered-empty comunica il contesto e la prossima azione. |
| S-05 | Selected | PASS | Trigger espone expanded e sheet nominato. |
| S-06 | Privacy | PASS | Filtri lavorano sul model locale. |
| S-07 | Disponibilità | PASS | Ricerca e filtri reali sono coperti. |

## Form

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| F-01 | Campi | PASS | Label, ordine e required sono verificati. |
| F-02 | Mobile | PASS | Form monocolonna e input decimal passano E2E. |
| F-03 | Errori | PASS | Alert leggibili e editor preservato. |
| F-04 | CTA | PASS | Salva, annulla ed Escape sono distinti. |
| F-05 | Overlay | PASS | Trap, Escape e focus return sono verdi. |
| F-06 | Loading | PASS | Disabled, aria-busy e doppio submit sono coperti. |
| F-07 | Layout | PASS | CTA e overlay sono raggiungibili nei sei viewport. |
| F-08 | Dati | PASS | Money, date, select e locale sono preservati. |

## Stati

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| B-01 | Loading | PASS | Salvataggio comunica lo stato e disabilita la CTA. |
| B-02 | Empty | PASS | Ledger vuoto espone contesto e azione. |
| B-03 | Error | PASS | Alert e recupero restano comprensibili. |
| B-04 | Offline | PASS | Uso locale continua e banner informa. |
| B-05 | Successo | PASS | Status conferma le mutazioni principali. |
| B-06 | Disabled | PASS | Stati disabled e dati parziali non sono nascosti. |

## Accessibilita

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| A-01 | Nomi | PASS | Controlli icon-only e landmark sono nominati. |
| A-02 | Keyboard | PASS | Tab, Shift+Tab, Enter, Space ed Escape sono coperti. |
| A-03 | Contrasto | PASS | Axe e semantica oltre il colore sono verdi. |
| A-04 | Zoom | PASS | Evidence 200% C2.7 preservata senza layout change. |
| A-05 | Annunci | PASS | Alert, status e aria-live sono presenti. |
| A-06 | Dati | PASS | Lista e dettaglio hanno alternativa testuale. |
| A-07 | Touch | PASS | Target interattivi >=44 px. |
| A-08 | Motion | PASS | Nessuna informazione dipende dal movimento. |
| A-09 | WCAG | PASS | Dialog, sheet, focus e axe passano. |

## Finanza

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| N-01 | Tipi | PASS | Entrata, uscita e transfer sono distinti. |
| N-02 | Transfer | PASS | Transfer neutri, fuori KPI e read-only. |
| N-03 | Dati | PASS | Segno, conto, categoria, stato e periodo corretti. |
| N-04 | Riconducibilità | PASS | Importi usano model e formatter ufficiali. |
| N-05 | Precisione | PASS | Money e minor units bigint invariati. |
| N-06 | Protezioni | PASS | Cestino e importazioni restano protetti. |
| N-07 | Locale | PASS | EUR, it-IT, ISO e Europe/Rome preservati. |
| N-08 | Dominio | PASS | Command layer reale e nessuna scrittura UI diretta. |

## Performance

| ID | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Q-01 | Risposta | PASS | Flussi comuni rispondono nei test E2E. |
| Q-02 | Dataset | PASS | Nessun render duplicato o dipendenza nuova. |
| Q-03 | Overlay | PASS | Sheet, dialog e dettaglio aprono stabilmente. |
| Q-04 | Proporzione | PASS | Nessun asset costoso è stato introdotto. |
| Q-05 | Error/offline | PASS | Stati locali e recupero restano comprensibili. |
