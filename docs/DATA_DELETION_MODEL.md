# Modello di cancellazione e reset dati

## Principi

Nexora distingue sempre archiviazione, cestino e cancellazione definitiva. Le operazioni che
modificano più record usano il confine atomico dell'adapter; non vengono introdotti `ON DELETE
CASCADE`, perché nasconderebbero effetti finanziari e renderebbero il rollback opaco.

I movimenti nel cestino non contribuiscono a saldi, report, budget, trend né notifiche. Per i
movimenti la strategia è soft-delete con data UTC e retention configurabile (30 giorni di default);
la cancellazione definitiva è un'azione separata e auditabile.

## Matrice delle dipendenze

| Entità | Riferimenti in ingresso | Eliminabile se inutilizzata | Eliminabile se usata | Archiviabile | Riassegnabile | Strategia |
|---|---|---:|---:|---:|---:|---|
| Account | transazioni, ricorrenze, piani, prestiti, investimenti, sottoconti | sì | no | sì | solo movimenti non-transfer | blocco o archiviazione; svuotamento atomico |
| Transaction | transfer, split, tag, import row | no | cestino | no | categoria/tag | soft-delete; trasferimento come bundle |
| Transfer | due gambe Transaction | no | cestino logico | no | no | entrambe le gambe nello stesso commit |
| Category | transazioni, split, budget, ricorrenze | sì | no | sì | sì | unione/riassegnazione atomica, poi rimozione |
| Tag | TransactionTag | sì | no | sì | sì | rimuovi o unisci evitando duplicati |
| Budget | categoria opzionale | sì | sì | no | categoria | rimozione isolata, non tocca movimenti |
| RecurringRule | account, categoria opzionale | sì | sì | disabilitazione | account/categoria | rimozione isolata, non tocca storico |
| AllocationPlan | due account | sì | sì | no | account | rimozione isolata |
| Loan | account | sì | conferma rinforzata | no | account | rimozione isolata; non annulla movimenti |
| InvestmentPosition | account | sì | sì | no | account | rimozione isolata; non annulla movimenti |
| ImportBatch/ImportRow | transazioni importate | no | audit conservato | no | no | reset finanziario; undo resta annullamento contabile |
| MonthlyJournal | nessuno | sì | sì | no | no | rimozione isolata |
| Backup history | storage locale | no | solo reset totale | no | no | preservata dal reset finanziario |

## Backend e rollback

SQLite/OPFS applica i comandi in una transazione SQL. IndexedDB usa una singola transazione sugli
object store coinvolti. Il repository in memoria prende uno snapshot prima dell'operazione per i
test. Il reset finanziario sostituisce atomicamente il ledger con il set di categorie di sistema;
il ripristino totale elimina anche il database selezionato e le preferenze controllate dall'app.

## Backup, cloud e audit

Ogni reset propone un archivio cifrato, ma l'utente può continuare solo dopo scelta esplicita.
Backup locali e Drive non vengono mai eliminati dal reset finanziario. L'eliminazione cloud è
un'opzione separata, disattivata per default, con esito per file. L'audit registra solo tipo,
timestamp e conteggi, mai importi, descrizioni, token o passphrase.
