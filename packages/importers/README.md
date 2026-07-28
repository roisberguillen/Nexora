# Importers

Parser e pipeline Money Manager, Mediobanca, N26 e generici.

La Milestone 4 include il primo parser locale per l'anteprima di workbook Money Manager:
lettura immutabile, rilevamento delle intestazioni, normalizzazione conservativa e
segnalazione delle righe che richiedono revisione. La scrittura nel ledger resta esclusa
fino ai successivi passaggi di validazione, deduplica e dry-run.
