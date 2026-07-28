# ADR 0006: Signed ledger amounts

## Stato

Accepted

## Contesto

Saldi, trasferimenti e report devono condividere una convenzione non ambigua senza
ricorrere al floating point.

## Decisione

- `income` usa un importo positivo;
- `expense` usa un importo negativo;
- la gamba debit di un trasferimento è negativa e quella credit è positiva;
- `adjustment` può avere entrambi i segni;
- transazioni annullate non modificano saldo o report;
- trasferimenti e rettifiche sono esclusi dai report income/expense;
- le fee sono transazioni expense separate;
- `bigint` viene serializzato ai boundary come stringa decimale.

Nella Milestone 1 i trasferimenti sono limitati alla stessa valuta. Il supporto
multivaluta richiederà un ADR dedicato per tasso, arrotondamento e valuta di report.

## Conseguenze

Il saldo di un conto è la somma del saldo iniziale e degli importi signed effettivi.
La somma delle due gambe di un trasferimento nella stessa valuta è sempre zero.
