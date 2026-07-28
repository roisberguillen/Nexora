# UI

Componenti accessibili condivisi.

La Milestone 0 include App Shell, navigazione responsive, header, design token ed error
boundary.

`FinancialAmount` formatta minor units `bigint` senza convertirle in `number`, usando
locale `it-IT` per impostazione predefinita. `MetricCard` costruisce le metriche
finanziarie della dashboard mantenendo separati valore, tono e testo di supporto.

La navigazione condivisa espone ora Panoramica e Conti come destinazioni disponibili,
con stato attivo coerente anche nel drawer mobile.
