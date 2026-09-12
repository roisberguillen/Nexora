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
| 3. Dashboard, Analisi, budget e diario | da iniziare | — |
| 4. Ricorrenze, allocazioni e selettori periodo | da iniziare | — |
| 5. Gate completo, documentazione e release | da iniziare | — |

## Fase 1 — evidenza

Il dominio espone validazione, risoluzione del periodo, estremi inclusivi/esclusivi e controllo di
appartenenza. Sono coperti default compatibile, giorno personalizzato, attraversamento dell’anno,
limiti di febbraio e rifiuto di valori non interi o fuori dall’intervallo `1–28`.
