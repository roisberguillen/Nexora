# 12.5.C4.8 — Estratti conto, mapping, annullamento ed esportazione

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`
Surface: Import, Movimenti, Conti, Export
Schermata: C4.8 complete bank statement import/export flow
Route: `#imports`, `#transactions`, `#accounts`, `#exports`
Routes: `imports`, `transactions`, `accounts`, `exports`
Task/Fase: 12.5.C4.8
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-09-05
Reviewer/fase: Codex — UI/UX + QA, 12.5.C4.8
Modifiche: gate E2E estratto conto generico, mapping/profilo, deduplica trasferimenti annullati, export CSV/XLSX e undo.
Result: `FLOW_AUDIT_PASS`
Esito: PASS
Flusso principale: CSV → mapping → profilo → preview → dry-run → conferma trasferimento → commit → export → reimport → undo
Viewport: 320, 375, 390, 768, 1024 e 1440 px; CDP 200% reale su 1024/1440

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Fixture CSV locale, preview/commit/reimport/undo ed export riconciliati. |
| Mobile | M-01 | PASS | Flusso completo a 320/375/390 px; nessun overflow o CTA irraggiungibile. |
| Desktop | D-01 | PASS | 1024/1440 px e zoom browser reale CDP 200%. |
| Tablet | T-01 | PASS | Percorso completo verificato a 768 px. |
| Visuale | V-01 | PASS | Import, Movimenti, Conti ed Export coerenti con il mockup ufficiale. |
| Ricerca | R-01 | PASS | Righe importate, conto, categoria e trasferimento restano ricercabili localmente. |
| Form | F-01 | PASS | Upload locale, mapping manuale, profilo, fallback account e conferma. |
| Feedback | FB-01 | PASS | Conteggi preview, batch committed/undone, duplicate e CTA export vuote. |
| Accessibilità | A-01 | PASS | Axe, tastiera/focus, target ≥44×44 e ordine di focus verificati. |
| Finanza | FN-01 | PASS | Minor units esatti, trasferimento neutro, saldi `1664,44/300,00`, undo `500,00/100,00`. |
| Performance | P-01 | PASS | Reload/nuova pagina, IndexedDB offline e benchmark 100.000 record senza retry. |

| Area | Esito | Evidenza |
| --- | --- | --- |
| Flusso | PASS | CSV generico locale, mapping manuale/profilo, preview, trasferimento confermato, commit, reimport, undo ed export. |
| Finanza | PASS | 4 righe importate, 5 transazioni ledger; saldi `1664,44/300,00`, totale `1964,44`; undo `500,00/100,00`, totale `600,00`. |
| Export | PASS | CSV/XLSX filtrati verificati realmente; minor units esatti, ordine deterministico, formula neutralizzata/static cell; annullati esclusi. JSON completo non filtrato e audit conservato. |
| Persistenza | PASS | Reload, nuova pagina e IndexedDB offline a 1440 px senza duplicati. |
| Accessibilità | PASS | Axe, focus visibile, tastiera, target almeno 44×44 e assenza overflow. |
| Privacy | PASS | Parsing/export locali; nessuna richiesta contenente file, nomi, controparti o importi sintetici. |
| Regressioni | PASS | 140 file Vitest / 628 pass / 4 skip; E2E dedicato 9 pass / 9 skip; full E2E 429 pass / 219 skip su 648; build, lint, typecheck, manifest e orchestratore verdi. |

Difetti corretti: export filtrati includevano movimenti `cancelled`; dry-run non riconosceva come
duplicato un trasferimento generico già annullato; CSV/XLSX restavano abilitati a risultato vuoto.
P0 aperti: Nessuno
P1/P2 aperti: Nessuno

Evidence principale: `test/e2e/c4-bank-statement-import-export-flow.spec.ts`.
