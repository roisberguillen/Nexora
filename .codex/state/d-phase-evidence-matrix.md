# Fase 12.5.D — Evidence reconciliation matrix

Audit task: `12.5.D.3 — Independent Accessibility Review`
Audit date: 2026-09-06
Baseline: `C5_FINAL_GATE_PASS`; C3/C4/C5 frozen.

La matrice distingue l’evidence precedente C3/C4/C5 dalla review indipendente richiesta per D.
Una dichiarazione nel changelog non è prova tecnica. `MISSING` indica che la review/evidence D
dedicata non è presente; non implica un failure del comportamento già chiuso in C3/C4/C5.

| Area | Stato D | Evidenza verificata | Gap / decisione |
| --- | --- | --- | --- |
| UI review | PASS | Review indipendente D.2 con screenshot IAB e checklist cross-surface | Nessun P0/P1/P2; nessuna correzione runtime |
| UX review | PASS | Review indipendente D.2 su shell, CTA, stati e percorsi condivisi | Nessun finding riprodotto |
| Responsive | PASS | Browser D.2 a 390/1440 e matrice C5-F a 320/375/768/1024/1440 | Nessun overflow o clipping riprodotto |
| Accessibility | PASS | Review D.3 WCAG 2.2 AA; AX tree, keyboard, focus, semantics, axe-core, zoom e responsive verificati | Nessun P0/P1/P2; nessuna correzione runtime |
| Security | MISSING | Security sanity C5 e review storiche presenti; nessuna D security review | D.4 dedicata |
| Browser verification | PASS | Screenshot IAB D.2 e review D.3 con suite Playwright sei profili; AX, focus, target, overlay e overflow verificati | D.2/D.3 chiuse; D.4 resta dedicata alla sicurezza |
| Automated tests | PASS | `pnpm verify`: 633 passed, 4 skipped; D.3 Playwright: 191 passed, 55 skipped, 0 failed | Skip condizionati dai profili; nessun failure nascosto |
| P0/P1 aperti | NO | D.3 review: P0/P1/P2 aperti `0/0/0` | Nessun blocker tecnico trovato; D non è ancora completa |
| Stato documentale | INCONSISTENT → RECONCILED | CHANGELOG conteneva una dichiarazione D COMPLETE; current-task/roadmap erano pending | Corretto il changelog e resa autorevole la roadmap/state |

## Decisione D.3

`12.5.D.3 PASS` come review indipendente accessibilità WCAG 2.2 AA. La Fase D non è completata:
`12.5.D = IN PROGRESS`.

Sottofasi realmente mancanti:

1. `12.5.D.4 — Security Review`
2. `12.5.D.F — Final Phase D Gate`

Il prossimo task autorizzato è esclusivamente `12.5.D.4`. D.4 non è stata avviata.
