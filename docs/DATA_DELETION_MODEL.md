# Modello di cancellazione e reset dati

## Principi

Nexora distingue sempre archiviazione, cestino e cancellazione definitiva. Le operazioni che
modificano più record usano il confine atomico dell'adapter; non vengono introdotti `ON DELETE
CASCADE`, perché nasconderebbero effetti finanziari e renderebbero il rollback opaco.

I movimenti nel cestino non contribuiscono a saldi, report, budget, trend né notifiche. Per i
movimenti la strategia è soft-delete con data UTC e retention configurabile (30 giorni di default);
la cancellazione definitiva è un'azione separata e auditabile.

La retention è una scadenza di revisione UI, non un job di cancellazione: Nexora non elimina mai
dati in background né mentre la PWA è chiusa. L'utente può ripristinare l'intero gruppo (incluse
le gambe di un trasferimento) oppure confermare `Svuota cestino`; quest'ultimo esegue una singola
operazione atomica su tutti i gruppi richiesti. La preview della selezione espone numero di gruppi,
trasferimenti e conti interessati prima della conferma.

La purga elimina nello stesso confine atomico tutti gli split, tag e le eventuali gambe del
trasferimento. Le `ImportRow` non vengono eliminate: spostano il riferimento dalla transazione
attiva a un identificatore storico non referenziale, così l'audit resta consultabile senza
impedire la cancellazione fisica del movimento.

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

Ogni reset mostra conteggi delle entità da eliminare e dei dati mantenuti. Propone un archivio
cifrato, lo verifica prima del download e conserva nella ricevuta solo il prefisso del checksum;
l'utente può proseguire senza backup soltanto con un consenso distinto. Se il blocco app è attivo,
il reset richiede nuovamente PIN/passphrase. Dopo il commit vengono rigenerati dashboard e
notifiche locali e restano soltanto le categorie di sistema `Entrate` e `Spese`.
Backup locali e Drive non vengono mai eliminati dal reset finanziario. Nel ripristino totale
l'eliminazione cloud è un'opzione separata, disattivata per default e disponibile solo quando
Google Drive è configurato; un errore cloud non annulla mai il risultato locale e il report
sessionale indica backup eliminati, rimanenti ed errori tecnici. L'audit registra solo tipo,
timestamp e conteggi, mai importi, descrizioni, token o passphrase.
