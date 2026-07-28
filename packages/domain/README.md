# Domain

Entità, value object, use case e invarianti senza dipendenze infrastrutturali.

La Milestone 1 include `Money`, `LocalDate`, `Account`, `Category`, `Transaction`,
`Transfer`, report di saldo e flusso di cassa e i contratti repository.

Gli importi sono sempre `bigint` in minor units. Le transazioni usano importi signed e
i trasferimenti nella stessa valuta hanno due gambe con somma zero.

`Account.update` espone soltanto i campi mutabili e `validateAccountUpdate` protegge
saldo iniziale, identità contabile e gerarchia durante le scritture del repository.
