# Riferimento UI Stitch ufficiale

## Provenienza e integrità

- Archivio sorgente: `stitch_file_instruction_processor.zip` ricevuto il 31 luglio 2026.
- SHA-256: `a38386091403dc18a5a653a43c2ea08f772f494c4f30de29ac5b1623e95b7184`.
- Contenuto inventariato: 98 schermate PNG e 98 prototipi HTML.
- Asset di riferimento: `screen.png`, `code.html` e `nexora/DESIGN.md` nell'archivio.

Stitch è la specifica ufficiale per struttura, gerarchia, spaziature, responsive, icone,
drawer, dialog, bottom sheet e stati UI. Palette, font, terminologia, dominio e invarianti
finanziarie restano quelli ufficiali del repository Nexora.

## Regole di utilizzo

- I file `code.html` non sono codice di produzione e non vengono serviti direttamente.
- Le feature ricostruiscono la UI con componenti React accessibili e riutilizzabili.
- Ogni schermata viene mappata a route, feature, stato e contratto dati nella Fase 1.
- I viewport obbligatori sono 320, 390, 768 e 1440 CSS px.

## Direzione visiva congelata

Nexora usa un linguaggio minimale e rassicurante: superfici pulite, bordi sottili, ombre minime,
spaziatura su griglia 4 px, contenuti prioritari visibili e densità diversa per desktop e mobile.
I token applicativi mantengono colori e font esistenti; Stitch non li sostituisce implicitamente.
