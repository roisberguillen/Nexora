# AGENTS.md — Istruzioni permanenti per Codex

## Missione
Costruire Nexora come applicazione finanziaria personale affidabile, installabile, offline-first e manutenibile.

## Ordine di lettura obbligatorio
1. `docs/CONTEXT.md`
2. `docs/PRD.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/ux/MOCKUP_INTEGRATION.md` e `design/mockup/stitch/DESIGN.md` per attività UI
6. `docs/ROADMAP.md`
7. ADR pertinenti in `docs/adr/`
8. skill pertinenti in `.codex/skills/`

## Regole operative
- Lavorare per milestone e vertical slice.
- Prima di modificare il codice, indicare file coinvolti, rischio e test previsti.
- Non inventare requisiti in conflitto con il PRD.
- Se un requisito è ambiguo, scegliere l'opzione più conservativa e documentarla in `docs/DECISIONS_LOG.md`.
- Ogni modifica funzionale richiede test.
- Ogni migrazione dati deve essere reversibile o accompagnata da backup automatico.
- Non memorizzare importi come `float`; usare minor units intere oppure Decimal.
- Non classificare mai un trasferimento interno come entrata o spesa.
- Non eseguire importazioni definitive senza anteprima e conferma.
- Nessun dato reale dell'utente nei fixture o nei log.
- Aggiornare `CHANGELOG.md` dopo ogni milestone completata.

## Definition of Done globale
- lint, typecheck e test verdi;
- nessun errore console rilevante;
- accessibilità base WCAG 2.2 AA;
- responsive da 320 px a desktop;
- coerenza con il mockup ufficiale per le superfici UI interessate;
- flusso offline verificato;
- migrazioni e rollback testati;
- documentazione aggiornata;
- criteri di accettazione soddisfatti.

## Convenzioni
- TypeScript strict.
- Nomi di dominio in inglese nel codice; UI italiana iniziale.
- Date ISO-8601; timezone predefinita `Europe/Rome`.
- Valuta predefinita EUR, locale `it-IT`.
- Commit piccoli e semanticamente coerenti.
