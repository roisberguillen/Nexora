# Roadmap — Giorno di inizio del mese finanziario

## Obiettivo

Consentire all’utente di scegliere il giorno civile che apre ogni periodo finanziario mensile.
Il valore predefinito è `1`; la prima versione supporta i giorni da `1` a `28` per garantire una
data valida in ogni mese.

## Decisioni di perimetro

- La preferenza è locale al dispositivo, come le altre preferenze applicative correnti.
- La chiave logica del periodo resta `YYYY-MM`, identificando il mese della data di apertura.
- I periodi sono intervalli civili semiaperti `[startDate, endDateExclusive)` in `Europe/Rome`.
- Cambiare la preferenza non modifica le date o i record dei movimenti.
- Le ricorrenze mantengono il proprio giorno nominale; la preferenza modifica soltanto le
  aggregazioni mensili.
- Il supporto ai giorni `29–31` è rinviato finché non viene approvata una policy per febbraio e mesi
  di 30 giorni.

## Fasi

| Fase | Stato | Evidenza |
|---|---|---|
| 1. Contratto dominio e confini calendario | completata | `packages/domain/src/services/financialPeriods.ts`, 9 test verdi |
| 2. Preferenza Impostazioni e validazione | completata | `apps/web/src/settings/preferences.ts`, `SettingsPage`, 14 test verdi |
| 3. Dashboard, Analisi, budget e diario | completata | `42fbbb9`; Dashboard/Analisi/budget/diario usano il periodo configurato |
| 4. Intervalli visibili e riallineamento selettori | completata | 28 test mirati, ESLint e typecheck web verdi; review UI/UX PASS |
| 5. Gate completo, documentazione e release | completata per la feature; gate repository bloccato da modifiche esterne | 661 test PASS, build/typecheck PASS; format/lint globali con errori fuori scope |

## Fase 1 — evidenza

Il dominio espone validazione, risoluzione del periodo, estremi inclusivi/esclusivi e controllo di
appartenenza. Sono coperti default compatibile, giorno personalizzato, attraversamento dell’anno,
limiti di febbraio e rifiuto di valori non interi o fuori dall’intervallo `1–28`.

## Fase 4 — evidenza

Dashboard, Analisi, Budget e Diario mostrano ora l’intervallo civile del periodo finanziario e
resettano la selezione al periodo corrente quando cambia il giorno iniziale. Il formatter condiviso
mantiene il formato mese/anno per il giorno `1` e mostra gli estremi per i giorni personalizzati.

- `pnpm exec vitest run apps/web/src/date/financialPeriodPresentation.test.ts apps/web/src/dashboard/buildDashboardViewModel.test.ts apps/web/src/analytics/buildAnalyticsViewModel.test.ts apps/web/src/budgets/BudgetsPage.test.tsx apps/web/src/journal/JournalPage.test.tsx` — 5 file, 28 test PASS;
- `pnpm exec eslint` sui file modificati — PASS;
- `pnpm --filter @nexora/web typecheck` — PASS;
- `.codex/reviews/ui-ux/financial-month-start-period-labels.md` — PASS.

## Fase 5 — evidenza finale

La funzionalità è completa e pubblicata sul branch `codex/pc-manager-local-browser`. Il gate
specifico della feature è verde; il gate globale del repository non può essere dichiarato verde
perché rileva modifiche parallele fuori scope:

- `pnpm test` — 146 file PASS, 661 test PASS, 4 skip;
- `pnpm build` — PASS;
- `pnpm typecheck` — PASS;
- `pnpm quality:ui-ux` — PASS;
- `pnpm format:check` — BLOCCATO da `scripts/edit-uploaded-money-manager.mjs` e
  `scripts/update-corrected-balances.mjs`, file non tracciati preesistenti;
- `pnpm lint` — BLOCCATO da `apps/web/src/settings/SettingsPage.tsx` e
  `apps/web/src/settings/localHostConnection.test.ts`, modifiche della roadmap parallela PM-6.

Commit della fase 4 e pubblicazione verificati: `6ba6b57c7706c605599a455aaf2b1e65541c71ec`.
