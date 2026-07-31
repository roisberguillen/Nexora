# ADR 0018: destinazioni di backup

## Stato

Accepted

## Decisione

Le sole destinazioni di backup supportate sono il file manuale cifrato `.nexora` e Google Drive.
NAS, SMB, cartelle di rete, agent Docker e servizi separati di backup sono eliminati dal
perimetro prodotto. Il Local Hub non è una destinazione backup.

## Conseguenze

Il Backup Engine è indipendente dalla destinazione e verifica ogni archivio prima di segnalarlo
come riuscito. La sincronizzazione locale non viene presentata come protezione dei dati.
