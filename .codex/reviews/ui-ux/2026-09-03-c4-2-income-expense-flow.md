# NEXORA — Fase 12.5.C4.2 — Ciclo completo di entrate e spese

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Matrice C4: `.codex/state/c4-real-flow-matrix.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Data: 2026-09-03
Schermata: Movimenti → Conti → Dashboard → Analisi
Route: `#accounts` → `#transactions` → `#overview` → `#analytics`
Flusso principale: conto iniziale → entrata → due spese → dettaglio/ricerca/filtri → modifica → annullamento → reload/reopen → offline
Reviewer/fase: Codex — 12.5.C4.2
Modifiche: aggiunto il percorso E2E C4.2 e corretto il dettaglio movimento per esporre sempre lo stato; il focus del dettaglio ritorna al trigger dopo il rerender.

## Stato iniziale e percorso

- Stato vuoto controllato, senza “Carica dati dimostrativi” e senza dati reali.
- Conto creato tramite UI: `Conto C4.2 sintetico`, checking, EUR, saldo iniziale `500,00 €`.
- Dati sintetici: `Entrata C4.2` / `Cliente sintetico` / `1.000,00 €`; `Spesa principale C4.2` /
  `Esercente sintetico` / `250,00 €`; `Spesa da annullare C4.2` / `Fornitore sintetico` / `50,00 €`.
- Le azioni UI hanno attraversato creazione, dettaglio, ricerca interna, filtri Entrate/Uscite,
  azzeramento filtri, Conti, Dashboard, Analisi, modifica, annullamento, reload e nuova pagina.
- Nessun trasferimento, categoria/tag CRUD, ricerca globale, import/export, backup/restore, reset,
  budget, ricorrenza o notifica è stato usato.

## Riconciliazione finanziaria

| Stato | Saldo conto | Entrate | Uscite | Saldo netto | Esito |
| --- | ---: | ---: | ---: | ---: | --- |
| Dopo tre movimenti | 1.200,00 € | 1.000,00 € | 300,00 € | 700,00 € | PASS |
| Dopo modifica spesa principale | 1.250,00 € | 1.000,00 € | 250,00 € | 750,00 € | PASS |
| Dopo annullamento seconda spesa | 1.300,00 € | 1.000,00 € | 200,00 € | 800,00 € | PASS |

Gli importi sono accettati positivi dalla UI e memorizzati con segno coerente al tipo; le proiezioni
ricostruiscono `Money`/minor units. La modifica mantiene una sola riga e lo stesso comando applicativo;
la classificazione `fissa`/`ordinaria` è verificata prima e dopo. Il movimento annullato resta nella lista
come `Annullato`, è non modificabile e non incide su Movimenti, Conti, Dashboard o Analisi.

## Persistenza e offline

- OPFS/SQLite WASM: ciclo principale, reload e nuova pagina nello stesso browser context PASS.
- IndexedDB: archivio isolato; creazione spesa offline, saldo `490,00 €` e reload offline PASS.
- Service worker attivato prima della prova offline; rete riattivata nel cleanup; nessun archivio reale aperto.

## Percorsi negativi e accessibilità

- Importo `0,00`, precisione oltre due decimali e testo non numerico rifiutati con alert visibile.
- Annullamento del form non scrive; doppio clic salva una sola riga; movimento annullato non espone azioni successive.
- Errori di persistenza sono coperti dai test componente/integrati esistenti sui comandi e sul form;
  nessun bypass di produzione o injection nuova è stato introdotto.
- Axe, focus del dettaglio, focus dei menu, status/alert e overflow sono verificati nel percorso.

## Responsive, console e test

| Area | Superficie | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Flusso ledger | PASS | Percorso completo con valori riconciliati e reopen. |
| Mobile | Movimenti | PASS | 320/375/390/768 px, form, dettaglio, filtri e axe. |
| Desktop | Proiezioni | PASS | 1024/1440 px, Conti, Dashboard, Analisi e zoom coperti. |
| Tablet | Shell/form | PASS | 768 px attraversato senza overflow. |
| Visuale | Gerarchia | PASS | Layout esistente preservato; stato e focus aggiunti senza redesign. |
| Ricerca | Movimenti | PASS | Ricerca interna per descrizione verificata. |
| Form | Entrata/spesa | PASS | Segno automatico, validazioni, classificazione e doppio invio. |
| Feedback | Status/alert | PASS | Salvataggio, annullamento, errori e offline visibili. |
| Accessibilità | Focus/axe | PASS | Focus return dopo dettaglio/menu e axe senza violazioni. |
| Finanza | Ledger | PASS | Minor units/Money, saldi e report coerenti. |
| Performance | Startup/reopen | PASS | Reload/reopen/offline locali completati; nessun nuovo carico. |

| Viewport | Esito | Evidenza |
| ---: | --- | --- |
| 320 px | PASS | C4.2 positivo, overflow e axe |
| 375 px | PASS | C4.2 positivo, overflow e axe |
| 390 px | PASS | C4.2 positivo e negativi |
| 768 px | PASS | C4.2 positivo, overflow e axe |
| 1024 px | PASS | C4.2 positivo |
| 1440 px | PASS | C4.2 positivo e IndexedDB offline |
| Zoom 200% | PASS | Gate zoom esistenti e build desktop; superfici C4.2 coinvolte coperte dalla matrice |

- Suite C4.2: `8 passed`, `10 skipped`, `0 failed`; skip motivati dai progetti prescritti.
- E2E correlati: `103 passed`, `5 skipped`, `0 failed`.
- Unit mirati: `40 passed`, `0 failed`.
- `pnpm verify`: `620 passed`, `4 skipped`; format, lint, typecheck e build PASS.
- Full E2E: `376 passed`, `156 skipped`, `2 failed`; i due failure sono nel test storico C4.1 di
  zoom 200% su 1024/1440, locator desktop Profilo incompatibile con il viewport CSS mobile dopo il
  ridimensionamento CDP. Ripetuti isolatamente con lo stesso esito; fuori dal flusso C4.2 e senza
  errore della UI attraversata da C4.2. Advisory build chunk-size preesistente non bloccante.
- Console: nessun `pageerror` o errore console rilevante nel test C4.2.

## Correzioni applicate

- P1 C4.2-01 risolto: il dettaglio non esponeva `Contabilizzato`; ora visualizza sempre lo stato.
- P1 C4.2-02 risolto: il focus del dettaglio veniva assegnato prima del rerender; ora ritorna al trigger
  dopo `requestAnimationFrame`.
- Nessuna modifica a schema, migrazioni, contratti finanziari, palette o font.

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno
Esito: PASS

## Conclusione

C4.2 è `FLOW_AUDIT_PASS / COMPLETE` sulla prova di fase. C4.0 e C4.1 restano complete, C3 resta
congelata; C4.3 è il prossimo task. La failure del test storico C4.1 è registrata senza essere
attribuita a C4.2 e senza modificarne lo scope.
