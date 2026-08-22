# Manifest di controllo UI/UX — Mobile e Desktop

**Versione:** `nexora-ui-ux-mobile-desktop/v1`
**Fonte:** `Nexora_Checklist_UI_UX_Mobile_Desktop.docx`
**Ambito:** ogni modifica Nexora; obbligatorio per modifiche che toccano UI, flussi, componenti, route, copy, dati visualizzati o comportamenti responsivi.

## Uso obbligatorio

1. Prima della modifica classificare l'impatto con le sezioni sotto. Se non è UI/UX, registrare `N/A` motivato nel PR/commit.
2. Per modifiche UI/UX, copiare [il template](../../.codex/templates/ui-ux-review.md) in `.codex/reviews/ui-ux/<data>-<slug>.md`, compilare le sezioni pertinenti e chiudere tutti i P0.
3. Eseguire `pnpm quality:ui-ux`. Il gate controlla che una review valida accompagni i file UI in stage.
4. Un `N/A` è ammesso solo con motivazione concreta. Le condizioni non verificabili vanno segnate come P1/P0, non come `PASS`.

## Esito e severità

- `PASS`: verificato e conforme.
- `N/A`: non applicabile, con ragione registrata.
- `P1`: da correggere prima del rilascio della superficie interessata.
- `P0`: blocca commit e rilascio; include perdita dati, importo/saldo errato, trasferimento interno errato, barriera accessibilità critica, route non raggiungibile o azione distruttiva senza protezione.

## A. Verifiche universali

| ID | Controllo |
| --- | --- |
| U-01 | Gerarchia, contrasto e spazio bianco rendono chiari contenuto, azioni e stati. |
| U-02 | Linguaggio breve e chiaro; massimo 5–7 azioni primarie nella vista. |
| U-03 | Link, route e CTA portano al risultato previsto; nessun overflow o testo tagliato. |
| U-04 | Stati hover/focus/active/disabled, feedback immediato e prevenzione del doppio invio. |
| U-05 | Tastiera, focus visibile e touch target di almeno 44×44 px ove interattivo. |

## M. Mobile (320, 360 e 375 px)

| ID | Controllo |
| --- | --- |
| M-01 | Nessuno scroll orizzontale; layout a colonna singola e contenuti senza tagli. |
| M-02 | Navigazione e CTA principali sono raggiungibili con una mano; menu scorre e si chiude. |
| M-03 | Tabelle, filtri e grafici hanno una variante mobile leggibile e azionabile. |
| M-04 | Nessuna funzione dipende da hover; target e spaziatura restano comodi al tocco. |
| M-05 | Caricamento, errori e transizioni mantengono prestazioni accettabili su rete/dispositivo mobile. |

## D. Desktop (da 1280 px)

| ID | Controllo |
| --- | --- |
| D-01 | Griglia e colonne sfruttano lo spazio senza vuoti o densità eccessiva. |
| D-02 | Navigazione principale resta individuabile; confronti, tabelle e liste usano orizzontalità quando utile. |
| D-03 | Hover ha un'alternativa accessibile; scorciatoie da tastiera, se presenti, non confliggono. |

## T. Tablet

| ID | Controllo |
| --- | --- |
| T-01 | Portrait e landscape non rompono contenuti, modali, pannelli o form. |
| T-02 | Navigazione, griglie e form si adattano al touch; pannelli/modal si chiudono e mantengono il focus. |

## V. Coerenza visiva

| ID | Controllo |
| --- | --- |
| V-01 | Tipografia, pesi, spaziature, colori semantici e icone seguono il mockup ufficiale e i token approvati. |
| V-02 | Tema chiaro/scuro non introduce testo illeggibile; icone ambigue hanno label o tooltip. |
| V-03 | Immagini non sono distorte; animazioni sono utili e rispettano `prefers-reduced-motion`. |

## S. Ricerca, filtri e risultati

| ID | Controllo |
| --- | --- |
| S-01 | Input riconoscibile, esempio/tooltip utile, focus e tastiera coerenti. |
| S-02 | Suggerimenti, filtri, default e reset sono comprensibili; risultati mostrano anteprima quando serve. |
| S-03 | Stati nessun risultato, caricamento, errore e retry sono espliciti; ricerche recenti sono cancellabili e rispettano la privacy. |

## F. Form e azioni

| ID | Controllo |
| --- | --- |
| F-01 | Su mobile il form è monocolonna; label persistenti, obbligatorietà e gruppi sono chiari. |
| F-02 | Tipo input, tastiera, maschere e validazione contestuale prevengono inserimenti errati. |
| F-03 | Errori sono vicini al campo, leggibili da screen reader e spostano il focus; password mostrabile e con forza quando applicabile. |
| F-04 | Annulla/indietro non perde dati senza conferma; multi-step mostra avanzamento; pagamenti riepilogano importo, commissioni e conferma. |

## B. Feedback, stati e resilienza

| ID | Controllo |
| --- | --- |
| B-01 | Successo, errore, loading, empty state, offline e conflitti sync spiegano cosa accade e cosa fare. |
| B-02 | Operazioni distruttive richiedono conferma e, quando possibile, undo; nessun caricamento infinito. |

## A. Accessibilità (WCAG 2.2 AA)

| ID | Controllo |
| --- | --- |
| A-01 | HTML semantico, ARIA solo quando necessario, label accessibili, alt text e annunci `aria-live` corretti. |
| A-02 | Tutto è usabile da tastiera, focus visibile e ordine logico; zoom al 200% resta utilizzabile. |
| A-03 | Contrasto almeno 4.5:1 per testo e 3:1 per grafica/UI; il colore non è l'unico segnale. |
| A-04 | Touch target >=44×44 px e movimento riducibile senza perdere funzionalità. |

## N. Dati e flussi finanziari Nexora

| ID | Controllo |
| --- | --- |
| N-01 | Importi, saldi, conti, segno, data, beneficiario, categoria, stato e valuta sono accurati e non ambigui. |
| N-02 | Il denaro usa minor units intere/Decimal, con arrotondamenti e totali riconciliabili; mai float. |
| N-03 | I trasferimenti interni sono espliciti ed esclusi da entrate/spese e dai riepiloghi impropri. |
| N-04 | Filtri, confronti e grafici non alterano i totali; empty state indica contesto e prossima azione. |
| N-05 | Import richiede anteprima e conferma; regole validano i campi monetari. |
| N-06 | Sicurezza/privacy, autenticazione/timeout, stato offline e ultimo aggiornamento sono visibili dove rilevanti. |
| N-07 | Date e calendario rispettano ISO-8601, `Europe/Rome`, EUR e locale `it-IT`. |

## Q. Prestazioni e chiusura

| ID | Controllo |
| --- | --- |
| Q-01 | Primo contenuto utile è prioritario; caricamenti progressivi/lazy non bloccano l'interazione. |
| Q-02 | Nessun jank o asset sproporzionato; errori di rete, limiti e retry sono recuperabili. |
| Q-03 | Offline e ritorno online preservano il contesto e comunicano lo stato. |

Una modifica è chiudibile solo con: review compilata, P0 pari a `Nessuno`, gate verde, test pertinenti verdi e criteri di accettazione documentati.
