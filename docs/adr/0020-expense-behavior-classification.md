# ADR 0020 — Classificazione comportamentale delle spese

## Stato

Accettata — Fase 12.2.

## Contesto

Macro categoria e sottocategoria descrivono la destinazione economica. Fisso/variabile,
ordinario/straordinario e ricorrente/una tantum sono dimensioni indipendenti e non devono creare
categorie improprie né riclassificare lo storico.

## Alternative considerate

1. Aggiungere i concetti alla `Category`: respinta, perché una stessa sottocategoria può includere
   spese con comportamento diverso.
2. Un enum unico su `Transaction`: respinta, perché mescola dimensioni indipendenti.
3. Campi opzionali expense-only su `Transaction` e calendario in `RecurringRule`: scelta.
4. Aggiungere `recurringRuleId` subito: rinviata. La cancellazione fisica attuale delle regole
   renderebbe fragile il legame storico; non viene introdotta una seconda fonte di verità.

## Decisione

`Transaction` conserva opzionalmente `expenseVariability` (`fixed|variable`) e
`expenseExceptionality` (`ordinary|extraordinary`) solo quando `kind = expense`. L'assenza è lo
stato legacy/non classificato. Entrate, rettifiche e trasferimenti sono rifiutati dal dominio.

La ricorrenza resta soltanto in `RecurringRule`, che continua a gestire frequenza mensile,
intervallo, giorno nominale, policy weekend e prossima data. Una spesa ricorrente si configura
dalla pagina Ricorrenze; non esiste un flag libero `recurring` sulla transazione.

## Conseguenze

La migrazione v16 è additiva e nullable: non modifica importi, date, conti, categorie o storico.
I backup portabili, SQLite/OPFS, SQLite nativo e IndexedDB serializzano gli attributi opzionali.
L'estensione di frequenze oltre `monthly` resta candidata alla Fase 12.3.
