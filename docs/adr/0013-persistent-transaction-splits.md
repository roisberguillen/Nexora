# ADR 0013: Persistent transaction splits

## Stato

Accepted

## Contesto

Il PRD richiede la ripartizione di una singola entrata o spesa su più categorie. Un
campo testuale o più transazioni duplicate altererebbero saldo, audit trail e report.

## Decisione

- Uno split è una riga `TransactionSplit` collegata a una sola `Transaction`.
- Uno split è ammesso soltanto per transaction `income` o `expense`, non annullate.
- La transazione madre non possiede una categoria quando ha split.
- Ogni riga usa Money nella stessa valuta e lo stesso segno della transazione madre.
- La somma esatta delle righe è uguale all'importo della madre.
- Le categorie delle righe devono accettare il kind della madre e non essere archiviate.
- Gli split sono salvati insieme alla transazione in un unico commit; l'annullamento
  conserva le righe per audit, ma le esclude da ogni report della madre annullata.

## Conseguenze

SQLite riceve una tabella `transaction_splits` nella migrazione additiva e reversibile
v2; IndexedDB riceve il relativo object store nella versione 2. I report futuri per
categoria useranno le righe split quando presenti, al posto della categoria diretta
della transazione.
