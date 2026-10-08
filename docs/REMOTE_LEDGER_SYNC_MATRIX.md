# Matrice remote-mobile-host

Baseline verificata: `81912d840a9189d7a5c8a01b3a00919861465e40`.

La matrice distingue il contratto del dominio dal supporto effettivamente presente nel branch.
Il protocollo attuale usa operation versionate per entità e revisioni per `entityId`; il conflitto
è esplicito e non usa last-write-wins. Le direzioni indicate come `no` restano gate aperti.

| Metodo mutativo | Entità | Stato attuale | Operation | Conflitto/revisione | PC → telefono | Telefono → PC |
|---|---|---|---|---|---|---|
| `resetFinancialData` | ledger | non supportato | — | — | no | no |
| `saveAccount`, `updateAccount`, `deleteUnusedAccount` | account | bidirezionale incrementale per il core | `account.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveCategory`, `updateCategory`, `deleteUnusedCategory` | category | bidirezionale incrementale per il core | `category.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `mergeCategory` | category + riferimenti | delivery composta verificata | `category.upsert/delete` + `transaction.upsert` | revisioni per entità | sì, HTTP E2E | sì, adapter pull |
| `saveTag`, `updateTag`, `deleteUnusedTag` | tag | bidirezionale incrementale per il core | `tag.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `mergeTag`, `removeTagGlobally` | tag + relazioni | delivery composta verificata | `transaction_tag_set.replace` + `tag.delete` | revisioni indipendenti | sì, HTTP E2E | sì, adapter pull |
| `setTransactionTags` | transaction-tag set | bidirezionale incrementale | `transaction_tag_set.replace` | `transaction_id` | sì | sì, journal incrementale |
| `saveBudget`, `updateBudget`, `reviseBudget`, `deleteBudget` | budget | bidirezionale incrementale | `budget.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveRecurringRule`, `updateRecurringRule`, `deleteRecurringRule` | recurring rule | bidirezionale incrementale | `recurring_rule.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveAllocationPlan`, `updateAllocationPlan`, `deleteAllocationPlan` | allocation plan | bidirezionale incrementale | `allocation_plan.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveLoan`, `updateLoan`, `deleteLoan` | loan | bidirezionale incrementale | `loan.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveInvestmentPosition`, `updateInvestmentPosition`, `deleteInvestmentPosition` | investment | bidirezionale incrementale | `investment.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveMonthlyJournal`, `updateMonthlyJournal`, `deleteMonthlyJournal` | monthly journal | bidirezionale incrementale | `monthly_journal.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveImportBatch`, `commitImportBatch`, `undoImportBatch` | import batch/rows | delivery composta verificata | `import_batch.upsert` + `import_row.upsert` + transazioni | revisioni, cursor e idempotenza | sì, HTTP E2E | sì, adapter pull/apply |
| `saveTransaction`, `updateTransaction`, `saveTransactionWithSplits`, `saveTransactionWithDetails`, `updateTransactionWithDetails` | transaction | bidirezionale incrementale per il core | `transaction.upsert/delete` | `(entity_type, entity_id)` | sì | sì, journal incrementale |
| `saveTransfer`, `cancelTransfer` | transfer + legs | bidirezionale incrementale per il core | `transfer.upsert/delete` + leg operations | `(entity_type, entity_id)` | sì, delivery multi-operation | sì, journal incrementale |
| `cancelTransaction` | transaction | delivery verificata | `transaction.upsert` | `(entity_type, entity_id)` | sì, HTTP E2E | sì, adapter pull |
| `trashTransaction`, `trashTransactions` | trash | delivery composta verificata | `transaction_trash.upsert` | `(entity_type, entity_id)` | sì, HTTP E2E | sì, adapter pull |
| `restoreTransaction` | trash/transaction | delivery verificata | `transaction_trash.delete` | `(entity_type, entity_id)` | sì, HTTP E2E | sì, adapter pull |
| `purgeTrashedTransaction`, `purgeTrashedTransactions` | trash/transaction | delivery composta verificata | `transaction.delete` + `transaction_trash.delete` | revisioni per entità | sì, HTTP E2E | sì, adapter pull |

Per le cinque entità core il repository SQLite del telefono installa trigger journal atomici quando
il Local Hub apre `nexora.db`: la mutazione normale, l'incremento della revisione e l'append con
cursor avvengono nella stessa transazione. Il PC applica il pull incrementale alla cache e aggiorna
cursor/revision; le delete producono tombstone. Il journal usa `sync_operations` con cursor
autoincrementale, `entity_type`, `entity_id`, `base_revision`, `revision`, payload e timestamp, e
`sync_revisions` con chiave primaria composta `(entity_type, entity_id)`. Le operazioni applicate dal
PC impostano un flag transazionale di soppressione per evitare echo nel pull.

Evidenza aggiunta in `apps/local-hub/src/lib.rs`:
`real_http_composed_mutations_imports_conflict_retry_and_restart_converge`. Il test usa un server
HTTP reale su porta effimera e SQLite temporaneo e verifica bootstrap, push, pull, ACK, conflitto,
retry idempotente, cursor, riavvio, import save/commit/undo e `integrity_check`/foreign keys.
La matrice copre le operazioni verificate dal protocollo e dagli adapter; il gate complessivo
`remote-mobile-host` resta aperto per la validazione TLS completa della chiave pubblica/SAN,
Android signing e i gate di piattaforma non ancora verdi.
