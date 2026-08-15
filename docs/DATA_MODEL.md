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

Per una `expense`, `expenseVariability?` è `fixed|variable` e `expenseExceptionality?` è
`ordinary|extraordinary`. Entrambi sono opzionali per mantenere i movimenti legacy non classificati
e sono vietati per income, transfer e adjustment. La ricorrenza non è un campo del movimento:
frequenza, intervallo e calendario rimangono in `RecurringRule`.

### Transfer
`id, debitTransactionId, creditTransactionId, exchangeRate?, feeTransactionId?`

Nella Milestone 1 sono supportati trasferimenti nella stessa valuta; la fee è una
transazione expense separata. Il multivaluta è rinviato alla definizione delle regole
Decimal, cambio e arrotondamento.

### Category
`id, name, parentId?, kindScope, isArchived`

La classificazione finanziaria usa esclusivamente due livelli: **Macro categoria → Sottocategoria**.
Una macro non ha `parentId`; una sottocategoria ha una sola macro attiva come padre e non può a sua
volta avere figli. Il padre deve esistere e il suo `kindScope` deve contenere quello del figlio:
`income → income`, `expense → expense`, `both → income|expense|both`. Le categorie archiviate
restano leggibili nelle registrazioni storiche ma non vengono offerte per nuove registrazioni,
budget o ricorrenze. Le proprietà fisso, variabile, periodico e straordinario non appartengono a
questa entità e saranno modellate separatamente.

### Tag / TransactionTag
Relazione molti-a-molti.

### RecurringRule
`id, name, kind, accountId, amount, categoryId?, payee?, frequencyUnit, interval, nominalDay,
nominalMonth?, weekendPolicy, nextNominalDate, nextExpectedDate, enabled, retiredAt?`

`frequencyUnit` è `week|month|year` e `interval` è un intero positivo: è l'unica fonte della
frequenza. `nextNominalDate` è il cursore civile; `nextExpectedDate` è derivata dalla policy
weekend e non sposta la serie nominale. Le regole legacy mensili restano leggibili. Una regola non
crea movimenti automaticamente e non aggiunge alcun flag di ricorrenza alla `Transaction`.

### AllocationPlan
`id, name, trigger, sourceAccountId, targetAccountId, amountMinor, currency, enabled`

Un piano è una proposta di trasferimento per stipendio o reddito fotografico; non entra
in saldi, report o storico finché l'utente non ne conferma l'esecuzione. Una conferma usa un
`executionId` tecnico: transfer e due gambe hanno identità deterministiche per `executionId` e
piano, così retry e richieste concorrenti non duplicano il bundle. Un piano attivo richiede conti
esistenti, non archiviati e nella stessa valuta; un piano disattivato può restare nello storico
anche dopo l'archiviazione di un conto.

### Budget
`id, period, categoryId?, amountMinor, firstAlertPercentage?, secondAlertPercentage?`

`categoryId` può indicare una macro-categoria, una sottocategoria oppure restare assente per un
limite globale su tutte le spese. Il perimetro di una macro include la macro e tutte le sue
sottocategorie, comprese quelle archiviate utili allo storico; una sottocategoria non include le
sorelle. Macro e sottocategorie possono avere budget distinti nello stesso periodo, ma non può
esistere più di un budget per la medesima coppia `period` + perimetro (incluso il perimetro globale).

Il consumo considera solo `expense` `booked` o `reconciled` nel periodo. Entrate, trasferimenti,
rettifiche, movimenti attesi o annullati non incidono. Se una transazione ha split, contribuiscono
solo le righe split compatibili con il perimetro: la transazione madre, priva di categoria diretta,
non viene mai conteggiata due volte. Importo speso, residuo, percentuale e stato sono viste pure in
minor units, non valori persistiti.

I nuovi budget sono creati dall'application layer nel mese corrente `Europe/Rome`, su una
sottocategoria attiva, con due soglie percentuali esplicite: `firstAlertPercentage` e
`secondAlertPercentage`. Entrambe sono interi da 1 a 100 e la prima è strettamente minore della
seconda. Non esistono valori predefiniti per i nuovi budget. La migrazione v18 conserva invece i
budget legacy convertendo i vecchi avvisi attivi nelle soglie storiche 80 e 100; un avviso legacy
disattivato resta assente. Il Centro notifiche usa queste soglie senza introdurre un secondo
sistema di notifiche.

### Loan
`id, accountId, lender, originalPrincipalMinor?, remainingPrincipalMinor, installmentMinor, installmentsPaid?, installmentsRemaining?, nextDueDate?`

### InvestmentPosition
`id, accountId, symbol?, name, units?, costBasisMinor, currentValueMinor, valuationDate`

Il rendimento è derivato come `currentValue - costBasis`; la percentuale è una vista,
non un valore monetario persistito.

### MonthlyJournal
`id, period, note?, nextMonthGoals?, perceivedControl?`

Un solo diario per mese `YYYY-MM`. Testo e obiettivi sono opzionali e limitati a 4.000
caratteri; la percezione di controllo è un valore discreto da 1 a 5. Il diario non
modifica saldi, budget o report finanziari.

### Budget
`id, seriesId, period, effectiveToPeriod?, categoryId?, amount, firstAlertPercentage?, secondAlertPercentage?`

`period` è l'inizio di validità della revisione mensile e `effectiveToPeriod` ne è il limite
esclusivo. Una configurazione resta attiva nei mesi successivi senza generare copie fisiche. Le
revisioni di una stessa `seriesId` non possono sovrapporsi. Nuove configurazioni richiedono una
sottocategoria di spesa attiva; budget globali o macro preesistenti sono mantenuti come storico.

### SavingsGoal
`id, accountId?, name, targetMinor, currentMinor, targetDate?`

### ImportBatch
`id, importerType, sourceFilename, sourceSha256, mappingProfileId?, status, startedAt, completedAt?, rowsTotal, rowsImported, rowsSkipped, rowsFailed`

Nella Milestone 4 un batch procede da `previewed` a `committed` oppure `undone`. Il commit
è valido soltanto se tutte le righe sono presenti: ogni riga `imported` corrisponde a una
Transaction con `source=import`, `importBatchId` e fingerprint. Una riga confermata come
trasferimento può materializzare due gambe collegate: l'audit punta alla gamba presente
nell'estratto e il repository conserva atomicamente anche la contro-gamba. Duplicate e righe
da revisionare restano nell'audit senza creare movimenti.

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
- v11: `monthly_journals` aggiunge riflessioni mensili, con periodo univoco e vincoli
  sui testi e sul valore di controllo, senza intervenire sulle tabelle esistenti.
- v12: `transaction_trash` conserva i movimenti eliminati logicamente fuori da saldi e report.
- v13: `import_rows.deleted_transaction_id` preserva l'audit dopo l'eliminazione definitiva.
- v14: `import_batches.mapping_profile_id` associa in modo opzionale il profilo di mapping scelto;
  l'upgrade è nullable, additivo e conserva integralmente i batch v13.
- v15: `import_batches.importer_type_v3` aggiunge `generic_csv` mantenendo i discriminatori v1/v2
  per la compatibilità con tutti i batch precedenti.
- v19: `budgets.series_id` e `budgets.effective_to_period` rendono ricorrenti i limiti mensili
  senza copie; le righe legacy sono trasformate in revisioni ordinate, senza eliminare record.
- v20: `import_batches.importer_type_v4` aggiunge `mediobanca_csv`, preservando i discriminatori
  precedenti e rendendo auditabile il riconoscimento strutturale dell'estratto Mediobanca Premier.

IndexedDB usa gli object store equivalenti,
con indici per scadenza, conto e trigger. Lo store `monthly_journals` ha un indice
univoco sul periodo; l'upgrade è alla versione 15, conserva store e record esistenti e supporta i
nuovi campi dei record `import_batches`.

Ricorrenze, budget, prestiti, investimenti, obiettivi e backup saranno introdotti tramite
migrazioni versionate insieme alle rispettive milestone. La decisione completa è descritta in
`docs/adr/0007-sqlite-core-schema-v1.md`.
