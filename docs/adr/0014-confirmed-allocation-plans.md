# ADR 0014: Confirmed allocation plans

## Stato

Accepted

## Decisione

Un piano di allocazione descrive un trasferimento proposto tra due conti nella stessa
valuta, attivato da stipendio o reddito fotografico. Il piano non crea movimenti da
solo: l'utente deve confermare esplicitamente l'esecuzione. La conferma crea ogni
trasferimento con le sue due gambe in un commit atomico; se una gamba non è valida, il
trasferimento corrispondente non viene registrato. Più piani confermati insieme sono
eseguiti in sequenza e non costituiscono una singola transazione di database.

Ogni conferma riceve un identificatore di esecuzione volatile ma persistito nella nota
tecnica delle due gambe del trasferimento. L'identità di transfer e gambe è deterministica
per coppia `executionId + planId`: una conferma concorrente o un retry non può quindi
creare un secondo bundle. Una ripetizione con lo stesso identificatore salta il piano già
registrato, anche dopo riapertura o ripristino di un backup. Dopo un fallimento parziale
l'interfaccia conserva l'identificatore e propone soltanto il retry sicuro; un nuovo evento
confermato usa invece un nuovo identificatore e rimane un’operazione esplicita.

## Conseguenze

I piani possono essere modificati, disattivati o eliminati senza alterare lo storico. Un
conto referenziato da un piano attivo non può essere archiviato finché il piano non viene
disattivato o corretto. Saldi e report considerano soltanto i trasferimenti effettivamente
confermati; i piani restano configurazione locale auditabile e non previsione contabile.
