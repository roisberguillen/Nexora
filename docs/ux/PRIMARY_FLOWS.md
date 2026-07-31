# Flussi UX principali

## Migrazione Money Manager
Carica file → scegli foglio → conferma intestazioni → mappa colonne → risolvi conti/categorie → anteprima anomalie → dry-run → conferma → report → eventuale annullamento batch.

## Registrazione stipendio
Rilevamento accredito → associazione ricorrenza → conferma “Stipendio ricevuto” → proposta allocazioni → anteprima trasferimenti → conferma.

## Trasferimento
Scegli origine/destinazione → importo → data → eventuale fee → conferma; UI mostra una sola operazione mentre il dominio crea due gambe.

## Correzione import
Apri batch → filtra needs_review → modifica mapping/valore → rivalida → applica soltanto righe corrette oppure annulla batch.

## Nuova registrazione mobile
Barra inferiore → pulsante “+” → “Aggiungi nuovo movimento” → pagina “Nuova registrazione” →
Entrata, Uscita o Trasferimento → validazione del command layer → conferma locale.

## Backup e notifiche locali
Profilo → Backup → crea o seleziona file `.nexora` → backup cifrato verificato o ripristino
protetto. Google Drive è una destinazione opzionale separata dal file manuale. La campanella apre
avvisi derivati dal ledger locale, con stato letto/ignorato conservato separatamente dai dati
finanziari.
