# Prompt Codex — UI Nexora dal mockup

Leggi nell'ordine:

1. `AGENTS.md`
2. `docs/PRD.md`
3. `docs/ux/PRIMARY_FLOWS.md`
4. `docs/ux/MOCKUP_INTEGRATION.md`
5. `design/mockup/stitch/DESIGN.md`
6. osserva `design/mockup/stitch/screen.png`
7. consulta `design/mockup/stitch/code.html` esclusivamente come riferimento

Obiettivo: implementare l'App Shell e la dashboard responsive di Nexora, usando componenti riutilizzabili e token centralizzati.

Prima di scrivere codice:

- elenca componenti e file da creare;
- estrai i design token dal mockup;
- segnala divergenze necessarie per accessibilità o responsive;
- definisci test unitari, accessibilità e visual regression.

Vincoli:

- non servire direttamente `code.html`;
- non copiare dati personali o introdurre feature non presenti nel PRD;
- non usare floating point per importi;
- UI italiana, locale `it-IT`, valuta EUR;
- supporto da 320 px al desktop;
- WCAG 2.2 AA;
- stati vuoto, errore, caricamento e offline.

Consegna la milestone come vertical slice verificabile e aggiorna changelog e decision log.
