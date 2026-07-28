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

### Budget
`id, period, categoryId?, amountMinor, alert80, alert100`

### Loan
`id, accountId, lender, originalPrincipalMinor?, remainingPrincipalMinor, installmentMinor, installmentsPaid?, installmentsRemaining?, nextDueDate?`

### InvestmentPosition
`id, accountId, symbol?, name, units?, costBasisMinor, currentValueMinor, valuationDate`

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

IndexedDB usa gli object store equivalenti `import_batches` e `import_rows`, con indice
per `batch_id`; l'upgrade è alla versione 4 e conserva gli store esistenti.

Ricorrenze, budget, prestiti, investimenti, obiettivi e backup saranno introdotti tramite
migrazioni versionate insieme alle rispettive milestone. La decisione completa è descritta in
`docs/adr/0007-sqlite-core-schema-v1.md`.
