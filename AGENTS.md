# AGENTS.md — Istruzioni permanenti per Codex

## Missione
Costruire Nexora come applicazione finanziaria personale affidabile, installabile, offline-first e manutenibile.

## ROADMAP AUTOPILOT
Quando l'utente richiede `ESEGUI ROADMAP COMPLETA`, eseguire la roadmap in continuità: per ogni task
atomico usare il router, implementare, eseguire test mirati e gate completi, aggiornare stato/evidenze,
finalizzare con commit Conventional Commit e push, verificare SHA remoto e working tree pulito, quindi
instradare immediatamente il solo task successivo autorizzato. Un completamento locale non autorizza mai
l'avanzamento. Se un test o un gate fallisce, correggere entro il budget del profilo; esaurito il budget,
marcare il task BLOCKED e fermare l'autopilot. Fermarsi anche per le stop condition della policy.

## Routing e ordine di lettura obbligatorio
1. Prima di ogni fase o task usare `.codex/skills/nexora-router` e pubblicare l'intestazione di
   classificazione prodotta da `pnpm codex:route`.
2. Consultare prima `.codex/state/current-task.md`, `roadmap-progress.md` e `repository-map.md`.
3. Usare `docs/CURRENT_SOURCES.md` per aprire soltanto le fonti autorevoli pertinenti; non rileggere
   automaticamente l'intero PRD o repository.
4. Per attività UI usare `docs/ux/MOCKUP_INTEGRATION.md` e il mockup Stitch ufficiale registrato
   nell'ADR 0019. Il mockup legacy è escluso.
5. Leggere soltanto ADR e skill pertinenti al task classificato.

## Regole operative
- Lavorare per milestone e vertical slice.
- Rispettare limiti di contesto, tentativi, agenti e test definiti in
  `.codex/orchestration/routing-policy.yaml`.
- Non usare sub-agent per attività meccaniche; usarli solo entro il limite del profilo e con un
  vantaggio indipendente verificabile.
- Prima di modificare il codice, indicare file coinvolti, rischio e test previsti.
- Non inventare requisiti in conflitto con il PRD.
- Se un requisito è ambiguo, scegliere l'opzione più conservativa e documentarla in `docs/DECISIONS_LOG.md`.
- Ogni modifica funzionale richiede test.
- Ogni migrazione dati deve essere reversibile o accompagnata da backup automatico.
- Non memorizzare importi come `float`; usare minor units intere oppure Decimal.
- Non classificare mai un trasferimento interno come entrata o spesa.
- Non eseguire importazioni definitive senza anteprima e conferma.
- Nessun dato reale dell'utente nei fixture o nei log.
- Non cancellare, resettare o sostituire silenziosamente dati locali dell'utente.
- Non dichiarare completata una fase parziale o priva delle evidenze richieste.
- Non modificare colori e font approvati; i layout seguono il mockup ufficiale.
- NAS, SMB e backup agent sono definitivamente fuori prodotto. I backup supportati sono file
  `.nexora` e Google Drive con account e cartella selezionati dall'utente.
- Nexora Local Hub è infrastruttura di sincronizzazione separata dal backup.
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
- Creare un commit separato per ogni fase o correzione critica; non unire scope indipendenti.
- Dopo ogni implementazione completata e verificata, usare `.codex/skills/commit-and-push`:
  creare un commit Conventional Commit e pubblicarlo su `origin`. Non lasciare modifiche
  funzionali completate soltanto in locale.
