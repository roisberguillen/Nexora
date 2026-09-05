# Nexora C4.0 — Framework dei flussi reali completi

## Obiettivo e confini

La C4 verifica dalla UI reale i percorsi completi che attraversano più superfici, dal loro
stato iniziale fino all'effetto persistito e alla sua rilettura. Il focus è su collegamenti,
persistenza, stati di errore, comportamento offline e correttezza finanziaria. La C4.0 è stata
preparatoria e documentale: la sua fotografia iniziale non dichiarava superata alcuna fase
C4.1–C4-F; le fasi successive sono ora aggiornate solo quando supportate dalla propria evidence.

La matrice autorevole è `.codex/state/c4-real-flow-matrix.md`. Una riga descrive un flusso
verificabile e non una singola schermata. Le evidenze della C3 restano immutate e non vengono
riutilizzate come prova sufficiente di un flusso completo.

## C3, C4 e C5

| Fase | Domanda | Unità di verifica |
| --- | --- | --- |
| C3 | La singola superficie è utilizzabile, accessibile e coerente? | schermata/stato, con review browser e freeze |
| C4 | Un obiettivo reale attraversa le superfici e conserva effetti e invarianti? | flusso end-to-end dalla UI, con reload/reopen e negativo |
| C5 | Le superfici condividono gli stessi pattern e la stessa terminologia? | componente, pattern, comportamento trasversale |

C4 non ripete l'audit visivo schermata per schermata di C3. C5 rimane separata e non viene
anticipata da rilievi di coerenza raccolti incidentalmente durante C4.

## Sequenza ufficiale

| Fase | Flusso da verificare | Stato iniziale |
| --- | --- | --- |
| 12.5.C4.0 | Framework e matrice dei flussi reali | COMPLETE |
| 12.5.C4.1 | Primo avvio, profilo, primo conto, persistenza e riapertura | COMPLETE |
| 12.5.C4.2 | Ciclo completo di entrate e spese | COMPLETE |
| 12.5.C4.3 | Ciclo completo dei trasferimenti | COMPLETE |
| 12.5.C4.4 | Categorie, sottocategorie, tag, ricerca globale e diario | COMPLETE |
| 12.5.C4.5 | Budget, ricorrenze, allocazioni e notifiche | COMPLETE |
| 12.5.C4.5-R | Chiusura offline delle allocazioni e riconciliazione documentale | COMPLETE |
| 12.5.C4.5-R2 | Refresh locale immediato e chiusura definitiva dei gate | COMPLETE |
| 12.5.C4.6 | Prestiti, investimenti, Dashboard e Analisi | COMPLETE |
| 12.5.C4.7 | Migrazione completa Money Manager XLSX | COMPLETE — FLOW_AUDIT_PASS |
| 12.5.C4.8 | Estratti conto, mapping, annullamento ed esportazione | COMPLETE — FLOW_AUDIT_PASS |
| 12.5.C4.9 | Backup manuale, restore, rollback e regressione Google Drive | COMPLETE — FLOW_AUDIT_PASS |
| 12.5.C4.10 | App Lock, impostazioni, cestino, reset, startup e recovery | COMPLETE — FLOW_AUDIT_PASS |
| 12.5.C4-F | Regressione completa e chiusura C4 | PENDING |

## Contratto di esecuzione

Ogni flusso deve:

1. partire da uno stato vuoto controllato o da una fixture sintetica deterministica;
2. usare esclusivamente azioni pubbliche della UI reale;
3. limitare il setup tecnico documentato e non scrivere direttamente nel repository durante il
   percorso verificato;
4. verificare gli effetti in tutte le schermate coinvolte;
5. controllare saldi, totali, budget, proiezioni e altri risultati pertinenti;
6. ripetere la verifica dopo reload e, quando applicabile, dopo nuova apertura della PWA;
7. provare retry, doppio invio e azioni ripetute quando il flusso le espone;
8. verificare annullamento, rollback o ripristino quando previsti;
9. controllare l'assenza di errori rilevanti nella console;
10. usare soltanto dati sintetici.

Le fixture devono essere piccole, nominate, riproducibili e prive di dati reali, credenziali,
token o identificativi personali. Gli import richiedono anteprima e conferma; i backup e restore
richiedono verifica di integrità, checkpoint e conferma esplicita. NAS, SMB e backup agent sono
fuori scope; i soli backup supportati sono `.nexora` e Google Drive scelti dall'utente.

## Copertura browser e offline

Le verifiche browser applicabili coprono 320, 375, 390, 768, 1024 e 1440 CSS px, tastiera e
focus, touch target fondamentali di almeno 44×44 px e assenza di overflow orizzontale. Quando
il flusso coinvolge form, dialog, sheet o contenuti interattivi si aggiunge il browser zoom reale
al 200% (non un semplice viewport ristretto). Si registrano route, viewport, stato, passaggi,
esito e screenshot solo quando aggiungono evidenza.

Per i flussi offline si disabilita la rete dopo il caricamento dell'applicazione, si eseguono le
azioni locali previste, si ricarica o si riapre quando applicabile e si verifica che nessuna
operazione richieda silenziosamente il cloud. L'eventuale riconnessione e il retry devono essere
espliciti e non duplicare operazioni. Le prove offline non certificano Local Hub o sincronizzazione,
che restano ambiti separati.

## Invarianti finanziarie

- Gli importi sono verificati in minor units intere o Decimal, mai tramite arrotondamenti float.
- Un trasferimento ha due gambe collegate e impatto netto zero su entrate, spese e reddito.
- Risparmio e trasferimenti sono esclusi dalle spese e dai budget di spesa.
- I saldi e i totali delle schermate collegate ricostruiscono lo stesso ledger.
- Split, categorie, sottocategorie e tag mantengono i riferimenti corretti.
- Importazione, undo, reset, cestino, restore e rollback non lasciano record parziali o duplicati.
- Le date rispettano il contratto ISO-8601, timezone `Europe/Rome` e il periodo visualizzato.
- I risultati dopo reload/reopen sono uguali a quelli confermati prima della chiusura.

## Negativi, errori e azioni distruttive

Ogni riga registra i percorsi negativi pertinenti: input invalido, dati mancanti, duplicato,
errore di persistenza, offline, retry, doppio invio, annullamento e permesso/integrazione
indisponibile. L'errore deve essere visibile, associato al controllo o al contesto, recuperabile
quando previsto e non deve mascherare un fallimento.

Le azioni distruttive richiedono riepilogo dell'impatto, conferma esplicita e percorso di undo,
restore o recovery quando previsto. Un annullamento deve lasciare lo stato precedente; un reset
non può cancellare dati senza la frase/seconda conferma richiesta dal prodotto; un restore non
può sostituire il ledger attivo senza verifica e checkpoint.

## Severità e gate di flusso

- **P0 — Bloccante:** perdita/corruzione dati, risultato finanziario errato, flusso fondamentale
  impossibile o grave violazione di sicurezza.
- **P1 — Rilevante:** funzione importante inutilizzabile, persistenza incoerente, percorso
  negativo non gestito, CTA/focus che impedisce il flusso o overflow critico.
- **P2 — Miglioramento:** difetto minore che non altera uso, dati o correttezza finanziaria.

Una riga può ottenere `FLOW_AUDIT_PASS` solo con P0=0 e P1=0, percorso UI completo verificato,
risultati finanziari coerenti, reload/reopen verificati quando applicabili, negativi coperti,
console senza errori rilevanti, viewport e accessibilità pertinenti verificate ed evidence
rintracciabile. P2 aperti devono essere elencati.

`FLOW_AUDIT_BLOCKED` si assegna quando esiste un P0/P1, manca una prova obbligatoria, il flusso
non è attraversabile dalla UI reale o la persistenza/correttezza non è dimostrata. Test di una
sola pagina, snapshot, ispezione del codice o presenza di un test E2E non sono da soli sufficienti.

## Evidence obbligatoria

Per ogni flusso: fixture/stato iniziale; route e viewport; elenco delle azioni UI; schermate e
risultati osservati; valori attesi/ottenuti; reload/reopen e offline; negativi e azioni distruttive;
console; test esistenti con file e conteggio; test mancanti; screenshot o trace quando necessari;
P0/P1/P2 e stato. I comandi, conteggi, skip e failure sono registrati in
`.codex/state/test-evidence.md` senza dati reali.

## Gate finale C4

`C4_FINAL_GATE_PASS` richiede tutte le righe C4.1–C4.10 e C4-F completate con `FLOW_AUDIT_PASS`,
nessun P0/P1 aperto, P2 tracciati, matrice e test evidence riconciliati, test e quality gate
richiesti verdi, verifica offline e reload/reopen pertinente, console senza errori rilevanti e
documentazione aggiornata. C4.0–C4.10 sono ora le fasi completate in questo documento; C4-F resta
pending fino alla regressione finale.
