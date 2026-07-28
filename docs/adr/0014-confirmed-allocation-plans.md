# ADR 0014: Confirmed allocation plans

## Stato

Accepted

## Decisione

Un piano di allocazione descrive un trasferimento proposto tra due conti nella stessa
valuta, attivato da stipendio o reddito fotografico. Il piano non crea movimenti da
solo: l'utente deve confermare esplicitamente l'esecuzione. La conferma crea tutte le
gambe di trasferimento in un solo commit atomico; se una non è valida, non viene
registrato alcun movimento.

## Conseguenze

I piani possono essere modificati o disattivati senza alterare lo storico. Saldi e
report considerano soltanto i trasferimenti effettivamente confermati; i piani restano
configurazione locale auditabile e non previsione contabile.
