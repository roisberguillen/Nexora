# ADR 0021 — Calendario ricorrenze avanzato e occorrenze durevoli

## Stato

Accettata — 2026-08-08.

## Decisione

Una regola usa una sola rappresentazione della frequenza: `frequencyUnit` (`week`, `month` o
`year`) e `interval` positivo. Le etichette settimanale, trimestrale, semestrale e annuale sono
solo presentazione della combinazione, non enum duplicati.

`nextNominalDate` è il cursore civile canonico. `nextExpectedDate` è la data effettiva derivata
dalla policy weekend e viene validata, non usata per calcolare la scadenza successiva. Per mesi e
anni, il giorno nominale viene clampato all'ultimo giorno del mese di destinazione senza perdere
il giorno originale; il 29 febbraio torna 29 nel successivo anno bisestile. Il motore usa
aritmetica gregoriana su `LocalDate`, mai `Date` o conversioni UTC.

Una `RecurringOccurrence` risolta, identificata da regola e data nominale, resta un'estensione
riservata alla futura slice di conferma delle proposte: sarà allora atomica e idempotente. La Fase
12.3 non espone `skip` né genera transazioni, quindi non introduce una falsa deduplica o un audit
parziale. Una regola non crea mai una transazione senza conferma esplicita. I movimenti importati
non ricevono mai un legame dedotto.

## Conseguenze

- Lo schema v5 mensile resta leggibile; lo schema v17 aggiunge il contratto avanzato senza
  riscrivere le migrazioni distribuite.
- Pausa non crea arretrati alla riattivazione. Skip non disattiva la regola e non incide sui saldi.
- La classificazione facoltativa Fase 12.2 è un default della regola expense e viene copiata solo
  alla conferma della nuova transazione; lo storico resta immutabile.
- Backup, restore, reset e adapter includono i nuovi campi della regola con retrocompatibilità per
  archivi precedenti. Le occorrenze entreranno nello stesso contratto quando verrà introdotta la
  conferma esplicita delle proposte.
