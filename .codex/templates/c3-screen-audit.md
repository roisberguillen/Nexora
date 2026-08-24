# C3.x — Screen audit Nexora

Framework: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`
Fase: C3.x
Superficie/stato: una sola superficie o stato
Route/contenitore: `#route`, `shell` o `bootstrap`
Data: YYYY-MM-DD
Revisore: nome/ruolo
Flusso verificato: ingresso → azione → esito
Esito: `SCREEN_AUDIT_PASS` | `SCREEN_AUDIT_BLOCKED`

## Viewport ed evidence

- 320 / 375 / 390 px: Mobile — risultato/evidence
- 768 px: Tablet — risultato/evidence
- 1024 / 1440 px: Desktop — risultato/evidence
- Zoom browser 200%: metodo, viewport, risultato/evidence
- Keyboard-only, focus, safe area, touch `>=44×44 px`: risultato/evidence
- Browser/Playwright/screenshot/headed manuale: comando o percorso e artifact

## Mobile-first

Rispondere alle 11 domande del framework, con risultato ed evidence per ciascuna.

## Verifiche

| Area | Risultato | Evidence |
| --- | --- | --- |
| Funzionalità e CTA | PASS/FAIL/N/A motivato | |
| Mobile | PASS/FAIL/N/A motivato | |
| Desktop | PASS/FAIL/N/A motivato | |
| Responsive | PASS/FAIL/N/A motivato | |
| Stati UI | PASS/FAIL/N/A motivato | |
| Accessibilità | PASS/FAIL/N/A motivato | |
| Edge case | PASS/FAIL/N/A motivato | |
| Coerenza Nexora/Stitch | PASS/FAIL/N/A motivato | |

## Rilievi

### P0

Nessuno oppure ID, viewport/stato, evidence, impatto, proprietario e correzione.

### P1

Nessuno oppure ID, viewport/stato, evidence, impatto, proprietario e correzione.

### P2

Nessuno oppure ID, viewport/stato, evidence, impatto e proposta.

## Correzioni e test

- File modificati: elenco oppure `nessuno`.
- Test automatici: comando, conteggio, skip/failure motivati.
- Test browser/manuali: comando/percorso, viewport e artifact.
- Riferimenti: mockup, matrice Stitch, flusso, decisioni.

## Conclusione

`SCREEN_AUDIT_PASS` solo con P0/P1 assenti e tutti i gate/evidence richiesti; altrimenti
`SCREEN_AUDIT_BLOCKED`. Una superficie PASS entra in freeze C3.
