# 12.5.C5.1 — Navigation, header, page chrome, CTA e terminologia

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.C5.1
Schermata: App Shell cross-surface
Route: `bootstrap`, `#overview`, `#recurring`, `#budgets`, `#loans`, `#investments`, `#profile`
Data: 2026-09-06
Reviewer/fase: Codex — UI/UX + QA, 12.5.C5.1
Flusso principale: confronto desktop/mobile → patch shell e chrome → CTA equivalenti → responsive/accessibility E2E
Modifiche: layout MobileHeader, label/iconografia mobile, titoli chrome e nomi CTA di aggiornamento; test aggiornati.
Esito: PASS
Framework: `docs/ux/C5_CROSS_SURFACE_CONSISTENCY_FRAMEWORK.md`
Branch: `codex/phase-12-5-0-checkpoint`
Risultato: `C5.1 COMPLETE`; prossimo `12.5.C5.2`

## Decisioni e correzioni

- C5-001 CLOSED: `MobileHeader` passa da tre a quattro colonne, senza wrapping e con tre target
  iconici da 44 px; ordine, safe area, focus e accessible names invariati.
- C5-002 CLOSED: la pagina usa “Ricorrenze e allocazioni”, coerente con la sidebar e senza route
  separata.
- C5-003 CLOSED: “Home” è normalizzato a “Panoramica”; H1 “Panoramica finanziaria” resta il
  titolo descrittivo della pagina.
- C5-004 CLOSED: “Analisi” usa `overview` su desktop e mobile. Categorie/tag/import/export
  mantengono l’icona generica disponibile, sempre accompagnata da testo visibile.
- C5-005 CLOSED: `Salva modifiche` è il nome comune per gli update; `Nuovo`, `Crea` e `Aggiungi`
  restano distinti secondo la convenzione del framework.

## Ambiente, responsive e regressioni

- Viewport: `320`, `375`, `390`, `768`, `1024`, `1440` CSS px.
- E2E shell/budget/prestiti/ricorrenze: `28 passed`, `14 skipped`, `0 failed`, 1 worker.
- E2E investimenti + flusso C4 loans/investments/analytics: `14 passed`, `10 skipped`, `0 failed`,
  1 worker. Gli skip sono condizionati dai progetti/backend già dichiarati.
- Test mirati component/page: `27 passed`, `0 failed`.
- Console/page errors e overflow non hanno prodotto failure nei percorsi verdi. Il primo E2E fallito
  usava `dist` precedente alla patch; dopo `pnpm build` la riesecuzione è verde e il failure è
  conservato nell’evidence, non mascherato.

| Area | ID | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | C5-001…C5-005 chiusi nella matrice. |
| Mobile | M-01 | PASS | Header a riga singola e bottom nav verificati sui quattro viewport mobili. |
| Desktop | D-01 | PASS | Sidebar, route attiva, titoli e CTA verificati a 1024/1440. |
| Tablet | T-01 | PASS | 768 px senza overflow e con shell mobile prevista. |
| Visuale | V-01 | PASS | Screenshot pre/post del 390 px e confronto shell. |
| Ricerca | R-01 | PASS | Ricerca desktop/mobile e focus di ritorno non alterati. |
| Form | F-01 | PASS | Accessible names update verificati nei test pagina/E2E. |
| Feedback | FB-01 | PASS | CTA di salvataggio/loading preservano il comportamento esistente. |
| Accessibilità | A-01 | PASS | AX names, aria-current, target 44 px e focus shell verificati. |
| Finanza | FN-01 | PASS | Nessun dominio, persistenza, importo o invariante modificato. |
| Performance | P-01 | PASS | Build PASS; warning chunk-size preesistente soltanto. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno

## Stato finale

`12.5.C5.1 COMPLETE`. Nessuna nuova feature o route introdotta. La prossima attività è
`12.5.C5.2` — Form, dialog, feedback e system states; non avviata.
