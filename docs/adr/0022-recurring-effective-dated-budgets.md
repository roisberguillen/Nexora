# ADR 0022 — Budget mensili ricorrenti effective-dated

- **Stato:** accettata
- **Data:** 2026-08-11

## Contesto

Un limite mensile salvato come record per ogni mese richiede copie, job e manutenzione; non
permette inoltre di mostrare correttamente lo storico dopo una modifica. I budget v18 usavano
`period` come unico mese di consumo.

## Decisione

`Budget.period` rimane la colonna e il campo pubblico compatibile, con nuovo significato di
inizio validità. Ogni revisione ha `seriesId` stabile e `effectiveToPeriod?` esclusivo. La
risoluzione centrale usa l'intervallo `[period, effectiveToPeriod)`; non vengono creati record
automatici a inizio mese.

Una modifica nello stesso mese aggiorna la revisione corrente. Una modifica in un mese successivo
chiude la revisione e ne crea una nuova nella stessa transazione. Disattivare chiude il limite dal
mese seguente e non cancella né movimenti né storico. Le nuove configurazioni UI richiedono una
sottocategoria attiva di spesa; i perimetri globali o macro esistenti restano leggibili.

## Conseguenze

La migrazione SQLite v19 è additiva; la release conserva un checkpoint verificato e il percorso
di backup/ripristino viene verificato prima della pubblicazione;
trasforma le righe mensili legacy nello storico della stessa serie senza eliminarle. IndexedDB
passa alla versione fisica 19 e conserva i record. Snapshot portabili v1 normalizzano i budget
legacy prima della verifica canonica. Le notifiche usano la revisione attiva nel mese di Roma e
identificatori `budget-threshold:<revision>:<period>:<soglia>`.
