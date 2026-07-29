# Roadmap Main Quality Gated

Fonte normativa: `C:\Users\Roi23\Downloads\NEXORA_ROADMAP_MAIN_QUALITY_GATED.md`,
audit del 29 luglio 2026. Questa roadmap sostituisce lo stato dichiarativo della precedente
Release Candidate: ogni casella può essere selezionata soltanto dopo test mirati, quality gate,
documentazione, commit diretto su `main`, push e verifica del commit remoto.

## M0 — Baseline, versione e documentazione

- [x] Baseline riproducibile registrata con ambiente, commit, test e skip.
- [x] Versione derivata da una sola fonte e nessun placeholder produttivo.
- [x] Documentazione e report allineati a `main`.

## M1 — Copertura flussi distruttivi

- [x] Test component, adapter ed E2E per cestino, restore, purge, reset e ripristino totale.
- [x] Verificate invarianti di saldi, budget, trend, import, split e trasferimenti.

## M2 — Reset dati finanziari

- [x] Preview, backup preventivo verificato, scelta esplicita senza backup, PIN e ricevuta sicura.
- [x] Reset atomico con ricostruzione categorie di sistema, cache e notifiche riallineate.

## M3 — Ripristino totale locale e cloud opzionale

- [x] Pulizia locale con report per componente e recupero dagli errori.
- [x] Cancellazione Google Drive opzionale con doppia conferma ed esito parziale esplicito.

## M4 — Cestino e cancellazione multipla

- [x] Selezione multipla, preview, rollback, svuotamento, retention e undo sicuro.

## M5 — Conti, categorie e tag

- [x] Svuota conto protetto, unione/riassegnazione categorie e unione/rimozione tag.

## M6 — Gestione dati e accessibilità

- [x] Centro Gestione dati, preferenze operative o rimosse dalla UI e dialog accessibili completi.
- [x] Audit tastiera, screen reader, zoom e viewport 320/375/768/1024/1440.

## M7 — Hardening e chiusura

- [x] Benchmark 1k–100k dei nuovi flussi, recovery drill, controllo segreti e report finale.
- [x] Quality gate finale verde su `main` e report `MAIN_IMPLEMENTATION_REPORT_2026-07-29.md`.
