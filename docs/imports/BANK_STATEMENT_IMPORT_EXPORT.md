# Estratti conto e export locale

Gli estratti CSV/XLSX restano nel browser e seguono la pipeline locale obbligatoria: hash, parse,
mapping, normalizzazione, validazione, deduplica, anteprima, dry-run, commit atomico, report e undo.
Un estratto privo di conto richiede la scelta esplicita del conto locale; il trasferimento verso un
conto proprio richiede conferma e crea due gambe collegate.

Il profilo di mapping è persistito localmente e può essere riusato senza inviare dati al provider.
Le righe non interpretabili restano nell’audit con stato e motivazione; la reimportazione riconosce
anche i movimenti già annullati e non crea nuovi record.

CSV e XLSX esportano solo movimenti attivi e contabilizzati nello scope selezionato, ordinati in modo
deterministico per data e ID. Gli importi sono serializzati in minor units; i valori testuali che
iniziano con `=`, `+`, `-` o `@` sono neutralizzati nel CSV e restano celle statiche nell’XLSX.
Il JSON completo ignora i filtri e conserva entità, relazioni, batch, righe Import e movimenti
annullati per la portabilità e l’audit.
