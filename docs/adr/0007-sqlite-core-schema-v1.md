# ADR 0007: SQLite core schema v1

## Stato

Accepted

## Contesto

La Milestone 2 richiede una persistenza offline che mantenga le invarianti definite dal
dominio. SQLite supporta interi signed fino a 64 bit, mentre `Money` usa `bigint` e non
deve perdere precisione. Lo schema deve inoltre poter evolvere senza anticipare i moduli
funzionali non ancora implementati.

## Decisione

- La versione iniziale contiene soltanto `accounts`, `categories`, `transactions`,
  `transfers` e `schema_migrations`.
- Le tabelle sono `STRICT`.
- Gli importi in minor units sono stringhe decimali canoniche in colonne `TEXT`, con
  vincoli che escludono zero non ammesso, decimali, zeri iniziali e formati non numerici.
- Valute, date locali, enum, riferimenti e segni contabili hanno vincoli SQL coerenti con
  il dominio.
- Le date locali usano `YYYY-MM-DD`; gli istanti tecnici usano testo ISO-8601 UTC.
- Le chiavi esterne usano `RESTRICT` e ogni connessione deve abilitare
  `PRAGMA foreign_keys = ON`.
- Un trigger valida le due gambe e l'eventuale fee prima di creare un trasferimento.
  L'adapter dovrà comunque inserire l'intero bundle in una singola transazione SQLite.
- La migrazione `0001` include un percorso `down` completo. Tabelle per tag,
  importazioni, budget, ricorrenze e altri moduli saranno aggiunte da migrazioni
  successive.

## Conseguenze

- Gli importi restano esatti anche oltre il limite degli interi JavaScript e SQLite.
- Gli adapter dovranno convertire esplicitamente `bigint` da e verso stringhe.
- Lo schema fisico rimane piccolo e aderente al dominio disponibile.
- Le regole che richiedono confronti tra più record sono replicate nel database come
  difesa aggiuntiva, senza sostituire la validazione del dominio.
