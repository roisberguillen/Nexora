# Matrice remote-mobile-host

Baseline verificata: `e7a217fe3cb5827c3d73ffddb30286b801970515`.

La matrice distingue il contratto del dominio dal supporto effettivamente presente nel branch.
Il protocollo attuale usa operation versionate per entità e revisioni per `entityId`; il conflitto
è esplicito e non usa last-write-wins. Le direzioni indicate come `no` restano gate aperti.

| Metodo mutativo | Entità | Stato attuale | Operation | Conflitto/revisione | PC → telefono | Telefono → PC |
|---|---|---|---|---|---|---|
| `resetFinancialData` | ledger | non supportato | — | — | no | no |
| `saveAccount`, `updateAccount`, `deleteUnusedAccount` | account | PC→telefono implementato; telefono→PC ancora bootstrap | `account.upsert/delete` | `(entity_type, entity_id)` | sì | bootstrap only |
| `saveCategory`, `updateCategory`, `deleteUnusedCategory` | category | PC→telefono implementato; telefono→PC ancora bootstrap | `category.upsert/delete` | `(entity_type, entity_id)` | sì | bootstrap only |
| `mergeCategory` | category + riferimenti | non supportato | — | — | no | no |
| `saveTag`, `updateTag`, `deleteUnusedTag` | tag | PC→telefono implementato; telefono→PC ancora bootstrap | `tag.upsert/delete` | `(entity_type, entity_id)` | sì | bootstrap only |
| `mergeTag`, `removeTagGlobally` | tag + relazioni | non supportato | — | — | no | no |
| `setTransactionTags` | transaction-tag | non supportato | — | — | no | no |
| `saveRecurringRule`, `updateRecurringRule`, `deleteRecurringRule` | recurring rule | non supportato | — | — | no | no |
| `saveAllocationPlan`, `updateAllocationPlan`, `deleteAllocationPlan` | allocation plan | non supportato | — | — | no | no |
| `saveBudget`, `updateBudget`, `reviseBudget`, `deleteBudget` | budget | non supportato | — | — | no | no |
| `saveLoan`, `updateLoan`, `deleteLoan` | loan | non supportato | — | — | no | no |
| `saveInvestmentPosition`, `updateInvestmentPosition`, `deleteInvestmentPosition` | investment | non supportato | — | — | no | no |
| `saveMonthlyJournal`, `updateMonthlyJournal`, `deleteMonthlyJournal` | journal | non supportato | — | — | no | no |
| `saveImportBatch`, `commitImportBatch`, `undoImportBatch` | import batch/rows | non supportato | — | — | no | no |
| `saveTransaction`, `updateTransaction`, `saveTransactionWithSplits`, `saveTransactionWithDetails`, `updateTransactionWithDetails` | transaction | parziale | `transaction.upsert` | per entità | sì | bootstrap only |
| `saveTransfer`, `cancelTransfer` | transfer + legs | parziale | `transfer.upsert` | per entità | sì, server-side | bootstrap only |
| `cancelTransaction` | transaction | non supportato | — | — | no | no |
| `trashTransaction`, `trashTransactions` | trash | non supportato | — | — | no | no |
| `restoreTransaction` | trash/transaction | non supportato | — | — | no | no |
| `purgeTrashedTransaction`, `purgeTrashedTransactions` | trash/transaction | singolo purge parziale | `transaction.delete` | per entità | parziale | no |

La definizione di completamento richiede che ogni riga supportata percorra UI → cache → outbox →
operation → validazione Local Hub → transazione sul `nexora.db` del telefono → ACK, e che le
modifiche del repository Android producano eventi leggibili dal pull PC. Finché la matrice non viene
aggiornata con test PC→SQLite, telefono→PC, offline e conflitto per ogni riga, il gate
`remote-mobile-host` resta aperto.
