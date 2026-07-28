# Modello dati concettuale

## Value object
- Money: amountMinor bigint, currency ISO-4217.
- LocalDate: YYYY-MM-DD.
- DateTime: ISO-8601 UTC con timezone display separata.
- Percentage: decimal bounded.

Ai boundary JSON `amountMinor` è una stringa decimale, perché JSON non supporta
`bigint` nativamente.

## Entità principali

### Account
`id, name, type, institution, currency, parentAccountId?, openingBalanceMinor, isArchived, createdAt, updatedAt`

Gli Spaces N26 sono Account di tipo `virtual_subaccount` con `parentAccountId` verso il conto N26 principale.

Nella gestione conti della Milestone 3 nome, istituto, saldo iniziale e stato di
archiviazione sono aggiornabili. Tipo, valuta e conto padre sono immutabili dopo la
creazione. Il saldo iniziale può essere corretto soltanto prima del primo movimento;
in seguito le correzioni devono passare da una rettifica contabile. Un conto padre può
essere archiviato solo dopo i suoi sottoconti attivi, e un sottoconto non può essere
creato o riattivato sotto un padre archiviato.

### Transaction
`id, kind, status, accountId, amountMinor, currency, bookedDate, valueDate?, payee?, description?, categoryId?, note?, source, importBatchId?, sourceFingerprint?, createdAt, updatedAt`

Convenzione M1: income positivo, expense negativo, transfer debit negativo e credit
positivo, adjustment signed. Le transazioni annullate non hanno effetto sul saldo.

La prima UI movimenti della Milestone 3 permette registrazioni manuali income,
expense e adjustment, più trasferimenti same-currency. Un movimento `reconciled` non
può essere annullato: la correzione passa da una rettifica. Gli split richiedono una
relazione persistente fra transazione principale e righe di ripartizione e sono
rinviati a una migrazione dedicata, senza simulazioni transitorie nella UI.

Gli split persistenti usano `TransactionSplit(id, transactionId, categoryId, amountMinor,
currency, note?)`. Sono ammessi solo per income/expense non annullate, senza categoria
diretta sulla madre; tutte le righe hanno stessa valuta e segno e sommano esattamente
all'importo della transazione.

### Transfer
`id, debitTransactionId, creditTransactionId, exchangeRate?, feeTransactionId?`

Nella Milestone 1 sono supportati trasferimenti nella stessa valuta; la fee è una
transazione expense separata. Il multivaluta è rinviato alla definizione delle regole
Decimal, cambio e arrotondamento.

### Category
`id, name, parentId?, kindScope, isArchived`

### Tag / TransactionTag
Relazione molti-a-molti.

### RecurringRule
`id, templateTransactionId, frequency, interval, nominalDay?, weekendPolicy, nextExpectedDate, enabled`

### AllocationPlan
`id, name, trigger, sourceAccountId, targetAccountId, amountMinor, currency, enabled`

Un piano è una proposta di trasferimento per stipendio o reddito fotografico; non entra
in saldi, report o storico finché l'utente non ne conferma l'esecuzione.

### Budget
`id, period, categoryId?, amountMinor, alert80, alert100`

I budget considerano soltanto `expense` contabilizzate per il periodo e la categoria;
entrate, trasferimenti, rettifiche e annullamenti non incidono sul consumo.

### Loan
`id, accountId, lender, originalPrincipalMinor?, remainingPrincipalMinor, installmentMinor, installmentsPaid?, installmentsRemaining?, nextDueDate?`

### InvestmentPosition
`id, accountId, symbol?, name, units?, costBasisMinor, currentValueMinor, valuationDate`

Il rendimento è derivato come `currentValue - costBasis`; la percentuale è una vista,
non un valore monetario persistito.

### SavingsGoal
`id, accountId?, name, targetMinor, currentMinor, targetDate?`

### ImportBatch
`id, importerType, sourceFilename, sourceSha256, mappingProfileId?, status, startedAt, completedAt?, rowsTotal, rowsImported, rowsSkipped, rowsFailed`

Nella Milestone 4 un batch procede da `previewed` a `committed` oppure `undone`. Il commit
è valido soltanto se tutte le righe sono presenti: ogni riga `imported` corrisponde a una
sola Transaction con `source=import`, `importBatchId` e fingerprint, mentre duplicate e
righe da revisionare restano nell'audit senza creare movimenti.

### ImportRow
`id, batchId, rowNumber, rawJson, normalizedJson?, status, errorCode?, createdTransactionId?`

### BackupRecord
`id, destinationType, manifestVersion, checksum, status, startedAt, completedAt?, restoreTestedAt?`

## Invarianti
- Un trasferimento crea esattamente due movimenti collegati, salvo fee separata.
- La somma delle due gambe in stessa valuta è zero.
- Importi immutabili dopo riconciliazione; correzioni tramite rettifica o audit event.
- Un sourceFingerprint non può comparire due volte per lo stesso importer/account, salvo override esplicito.

## Schema fisico SQLite

La prima migrazione della Milestone 2 materializza soltanto il dominio già disponibile:

- `schema_migrations`;
- `accounts`;
- `categories`;
- `transactions`;
- `transfers`.

Le tabelle sono `STRICT`. Gli importi in minor units sono memorizzati come stringhe
decimali canoniche in colonne `TEXT`, perché SQLite limita `INTEGER` a 64 bit signed.
Date locali, enum, valute, riferimenti, segni contabili e bundle di trasferimento sono
protetti da vincoli o trigger. Ogni connessione deve abilitare le foreign key.

Le migrazioni additive successive mantengono invariati tutti i dati v1:

- v2: `transaction_splits` con riferimenti, indici e vincoli per le ripartizioni;
- v3: `tags` e `transaction_tags` per l'associazione molti-a-molti;
- v4: `import_batches`, `import_rows`, `transactions.import_batch_id` e
  `transactions.source_fingerprint`. L'indice parziale univoco
  `(account_id, source_fingerprint)` blocca l'importazione della stessa riga nello stesso
  conto; le foreign key collegano batch, righe e transazioni.
- v5: `recurring_rules` per template mensili con data attesa e weekend policy;
- v6: `allocation_plans` per proposte di trasferimento confermabili fra conti.
- v7: `budgets` per limiti mensili globali o di categoria;
- v8: `loans` per capitale residuo, rata e scadenza;
- v9: `investment_positions` per valutazioni manuali di portafoglio.
- v10: `import_batches.importer_type_v2` distingue i batch `money_manager_xlsx`,
  `mediobanca_xlsx` e `n26_pdf`, mantenendo il campo v4 e tutti i record precedenti.

IndexedDB usa gli object store equivalenti fino a `recurring_rules` e `allocation_plans`,
con indici per scadenza, conto e trigger; l'upgrade è alla versione 10 e conserva gli
store e i record esistenti.

Ricorrenze, budget, prestiti, investimenti, obiettivi e backup saranno introdotti tramite
migrazioni versionate insieme alle rispettive milestone. La decisione completa è descritta in
`docs/adr/0007-sqlite-core-schema-v1.md`.
