# 12.5.C5.0 — Initial cross-surface consistency review

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.C5.0
Schermata: Audit trasversale di shell, superfici, pattern e dati
Route: `bootstrap`, hash route principali `#overview`–`#privacy-security`
Data: 2026-09-06
Reviewer/fase: Codex — UI/UX + QA, 12.5.C5.0
Flusso principale: route reali → confronto shell/page/componenti → sei viewport → console/overflow → matrice rilievi
Modifiche: framework, matrice, review, state/evidence e manifest; nessuna modifica runtime o nuova feature.
Esito: PASS
Framework: `docs/ux/C5_CROSS_SURFACE_CONSISTENCY_FRAMEWORK.md`
Branch: `codex/phase-12-5-0-checkpoint`
Risultato: `12.5.C5.0 COMPLETE`; prossimo `12.5.C5.1`

## Esito

`C5.0 COMPLETE` — framework e matrice creati; nessuna nuova feature e nessun comportamento
finanziario modificato. C3/C4 restano congelate. Conteggio: P0 0, P1 0, P2 5, accepted 3.

## Browser evidence

- App reale raggiunta su localhost con hash route per Overview, Movimenti, Conti, Budget,
  Ricorrenze, Prestiti, Investimenti, Analisi, Diario, Categorie, Tag, Importa, Esporta, Backup,
  Notifiche, Impostazioni, Profilo e Privacy/Sicurezza.
- Viewport verificati: 320, 375, 390, 768, 1024 e 1440 CSS px.
- `scrollWidth === clientWidth` osservato su tutti i sei viewport nella dashboard; nessun overflow
  orizzontale. Screenshot manuale a 390 px su `#transactions` evidenzia il wrapping dell’icona
  notifiche nel MobileHeader.
- Console: nessun errore rilevante nel percorso IAB riuscito; la prima prova Playwright è stata
  bloccata dall’ambiente dipendenze e ripristinata con `pnpm install` autorizzato.
- Zoom 200% non viene dichiarato superato: è requisito delle slice che modificheranno form/dialog.

## Gap di fonte

`design/mockup/stitch/STITCH_UI_REFERENCE.md` e `design/mockup/stitch/STITCH_SCREEN_MATRIX.md`
non esistono. Le fonti corrispondenti autorevoli sono in `docs/ux/` e sono state usate.

| Area | ID | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | 18 route principali raggiunte e registrate nella matrice C5. |
| Mobile | M-01 | PASS | 320/375/390 verificati; wrapping header tracciato come P2 C5-001. |
| Desktop | D-01 | PASS | 1024/1440 verificati senza overflow. |
| Tablet | T-01 | PASS | 768 verificato senza overflow e con shell mobile prevista. |
| Visuale | V-01 | PASS | Screenshot 390 e confronto con Stitch/header condiviso. |
| Ricerca | R-01 | PASS | TopHeader, dialog mobile e route global search ispezionati. |
| Form | F-01 | PASS | CTA/label/placeholder cercati trasversalmente; nessuna regressione P0/P1. |
| Feedback | FB-01 | PASS | Loading/import, empty/dashboard, recovery e console controllati. |
| Accessibilità | A-01 | PASS | AX tree shell, route e names; focus/zoom restano gate pertinenti. |
| Finanza | FN-01 | PASS | `FinancialAmount`, EUR/it-IT, minor units e trasferimenti invariati. |
| Performance | P-01 | PASS | Build completata; advisory chunk-size preesistente, nessun failure. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: C5-001, C5-002, C5-003, C5-004, C5-005

## Decomposizione

`12.5.C5.1` → `C5.2` → `C5.3` → `C5.4` → `C5.5` → `C5-F`. Nessuna slice successiva viene
dichiarata completa in questa review.
