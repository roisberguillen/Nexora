# Matrice remote-mobile-host

Baseline verificata: `c1bf8d3d8decc0cce7477681d818e8bca96bc10e`.

La matrice distingue il contratto del dominio dal supporto effettivamente presente nel branch.
Il protocollo attuale usa operation versionate per entità e revisioni per `entityId`; il conflitto
è esplicito e non usa last-write-wins. Le direzioni indicate come `no` restano gate aperti.

| Metodo mutativo | Entità | Stato attuale | Operation | Conflitto/revisione | PC → telefono | Telefono → PC |
|---|---|---|---|---|---|---|
| `resetFinancialData` | ledger | non supportato | — | — | no | no |
| `saveAccount`, `updateAccount`, `deleteUnusedAccount` | account | bidirezionale incrementale per il core | `account.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveCategory`, `updateCategory`, `deleteUnusedCategory` | category | bidirezionale incrementale per il core | `category.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `mergeCategory` | category + riferimenti | non supportato | — | — | no | no |
| `saveTag`, `updateTag`, `deleteUnusedTag` | tag | bidirezionale incrementale per il core | `tag.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `mergeTag`, `removeTagGlobally` | tag + relazioni | non supportato | — | — | no | no |
| `setTransactionTags` | transaction-tag | non supportato | — | — | no | no |
| `saveRecurringRule`, `updateRecurringRule`, `deleteRecurringRule` | recurring rule | non supportato | — | — | no | no |
| `saveAllocationPlan`, `updateAllocationPlan`, `deleteAllocationPlan` | allocation plan | non supportato | — | — | no | no |
| `saveBudget`, `updateBudget`, `reviseBudget`, `deleteBudget` | budget | non supportato | — | — | no | no |
| `saveLoan`, `updateLoan`, `deleteLoan` | loan | non supportato | — | — | no | no |
| `saveInvestmentPosition`, `updateInvestmentPosition`, `deleteInvestmentPosition` | investment | non supportato | — | — | no | no |
| `saveMonthlyJournal`, `updateMonthlyJournal`, `deleteMonthlyJournal` | journal | non supportato | — | — | no | no |
| `saveImportBatch`, `commitImportBatch`, `undoImportBatch` | import batch/rows | non supportato | — | — | no | no |
| `saveTransaction`, `updateTransaction`, `saveTransactionWithSplits`, `saveTransactionWithDetails`, `updateTransactionWithDetails` | transaction | bidirezionale incrementale per il core | `transaction.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveTransfer`, `cancelTransfer` | transfer + legs | bidirezionale incrementale per il core | `transfer.upsert/delete` + leg operations | `(entity_type, entity_id)` | sì, delivery multi-operation | sì, journal incrementale |
| `cancelTransaction` | transaction | non supportato | — | — | no | no |
| `trashTransaction`, `trashTransactions` | trash | non supportato | — | — | no | no |
| `restoreTransaction` | trash/transaction | non supportato | — | — | no | no |
| `purgeTrashedTransaction`, `purgeTrashedTransactions` | trash/transaction | singolo purge parziale | `transaction.delete` | per entità | parziale | no |

Per le cinque entità core il repository SQLite del telefono installa trigger journal atomici quando
il Local Hub apre `nexora.db`: la mutazione normale, l'incremento della revisione e l'append con
cursor avvengono nella stessa transazione. Il PC applica il pull incrementale alla cache e aggiorna
cursor/revision; le delete producono tombstone. Il journal usa `sync_operations` con cursor
autoincrementale, `entity_type`, `entity_id`, `base_revision`, `revision`, payload e timestamp, e
`sync_revisions` con chiave primaria composta `(entity_type, entity_id)`. Le operazioni applicate dal
PC impostano un flag transazionale di soppressione per evitare echo nel pull.

Il gate `remote-mobile-host` resta aperto per le entità non core, per i metodi composti e per la
validazione TLS completa della chiave pubblica/SAN.
