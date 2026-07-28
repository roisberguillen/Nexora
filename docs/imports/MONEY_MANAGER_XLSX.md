# Specifica importazione Money Manager XLSX

## Obiettivo
Migrare lo storico contabile senza perdita di righe, significato o relazioni.

## Pipeline
1. Calcolo SHA-256 del file.
2. Lettura workbook senza mutare i valori sorgente.
3. Scelta foglio e riga intestazioni.
4. Rilevamento colonne candidate.
5. Mapping a schema canonico.
6. Normalizzazione locale/date/importi.
7. Classificazione tipo transazione.
8. Risoluzione conti e categorie.
9. Deduplicazione.
10. Anteprima e validazione.
11. Dry-run con report.
12. Commit atomico.
13. Audit e possibilità di undo batch.

## Campi canonici
`date, valueDate, account, destinationAccount, type, amount, currency, category, subcategory, payee, note, tags`

## Deduplica
Fingerprint consigliato:
`sha256(normalizedDate|accountId|amountMinor|currency|normalizedPayee|normalizedDescription|sourceRowId)`

La reimportazione dello stesso file deve produrre zero nuovi movimenti, salvo override consapevole.

## Trasferimenti
Se la riga indica conto origine e destinazione propri, creare un Transfer con due gambe. Non contare come entrata/spesa.

## Gestione errori
Ogni riga deve terminare in uno stato: imported, skipped_duplicate, needs_review, failed. Mai scartare silenziosamente.

## Dati necessari per finalizzare il parser
Un file XLSX reale esportato da Money Manager, anonimizzato se desiderato. Il mapping generico deve comunque funzionare prima del profilo specifico.
