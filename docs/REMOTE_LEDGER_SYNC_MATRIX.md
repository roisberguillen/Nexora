# Matrice sincronizzazione LedgerRepository remoto

Baseline: b6e0f76227c71f67154486ee5e8b5cef88ddbcab

| Metodo | Entità | Stato baseline | Strategia |
|---|---|---|---|
| resetFinancialData | ledger | non remoto | operation ledger atomica con revisione e conferma |
| save/update/deleteUnusedAccount | account | non remoto | upsert/tombstone idempotente |
| save/update/deleteUnusedCategory, mergeCategory | category | non remoto | upsert/tombstone con riferimenti validati |
| save/update/delete/merge/removeTag, setTransactionTags | tag/relation | non remoto | operation entità + relazione |
| save/update/deleteRecurringRule | recurring_rule | non remoto | upsert/tombstone |
| save/update/deleteAllocationPlan | allocation_plan | non remoto | upsert/tombstone |
| save/update/revise/deleteBudget | budget | non remoto | revisioni con controllo overlap |
| save/update/deleteLoan | loan | non remoto | upsert/tombstone |
| save/update/deleteInvestmentPosition | investment_position | non remoto | upsert/tombstone |
| save/update/deleteMonthlyJournal | monthly_journal | non remoto | upsert/tombstone |
| save/commit/undoImportBatch | import batch/rows | non remoto | batch atomico con righe e transazioni collegate |
| save/update/details/splits transaction | transaction | parziale | operation con dettagli e relazioni |
| saveTransfer/cancelTransfer | transfer | parziale | bundle atomico con gambe |
| cancel/trash/restore/purge transaction(s) | trash/transaction | parziale | tombstone semantico e ripristino atomico |

La matrice è una baseline di implementazione; il gate resta chiuso finché ogni riga non ha test PC→SQLite telefono, telefono→PC, offline e conflitto.
