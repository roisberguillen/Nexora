# 12.5.C4.6 — Prestiti, investimenti, Dashboard e Analisi

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: `Nexora_Checklist_UI_UX_Mobile_Desktop/v2`
Surface: Loans, Investments, Dashboard, Analytics, Accounts, Transactions
Schermata: C4.6 complete loan and investment flow
Route: `#accounts`, `#transactions`, `#loans`, `#investments`, `#`, `#analytics`
Routes: `accounts`, `transactions`, `loans`, `investments`, `overview`, `analytics`
Task/Fase: 12.5.C4.6
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-09-05
Reviewer/fase: Codex — UI/UX + QA, 12.5.C4.6
Modifiche: pannello secondario Dashboard per debiti/investimenti e flusso E2E completo.
Result: `FLOW_AUDIT_PASS`
Esito: PASS
Flusso principale: conti → movimenti → prestito/investimento → rata → aggiornamenti → trasferimento → Dashboard → Analisi → reload
Viewport applicabili: 320, 375, 390, 768, 1024 e 1440 px; CDP 200% su 1024/1440

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Flusso UI completo e valori riconciliati su sei viewport. |
| Mobile | M-01 | PASS | 320/375/390 px senza overflow; negativo a 390 px. |
| Desktop | D-01 | PASS | 1024/1440 px con zoom browser reale CDP 200%. |
| Tablet | T-01 | PASS | Percorso completo verificato a 768 px. |
| Visuale | V-01 | PASS | Pannello secondario separato dai KPI; colori/font approvati invariati. |
| Ricerca | R-01 | PASS | Link accessibili verso `#loans` e `#investments`; Dashboard/Analisi riconciliate. |
| Form | F-01 | PASS | Creazione e modifica di prestito, investimento, movimenti e trasferimento. |
| Feedback | FB-01 | PASS | Feedback di salvataggio, avanzamento prestito e rendimento visibili. |
| Accessibilità | A-01 | PASS | Axe, tastiera/focus, target e overflow controllati nel test dedicato. |
| Finanza | FN-01 | PASS | Prestito `4.828,00`, investimento `1.200,00`, gain `140,00 / 13,20%`, disponibilità `9.468,00`; trasferimento escluso dal cash-flow. |
| Performance | P-01 | PASS | Refresh locale e persistenza IndexedDB senza rete verificati. |

## Evidenza e riconciliazione

La fixture sintetica congelata a `2026-09-05T10:00:00+02:00` crea il conto operativo EUR da
`5.000,00`, Directa investimento e Findomestic prestito, poi registra agosto (`2.800,00 / 600,00`)
e settembre (`3.000,00 / 500,00`). La rata manuale di `172,00` aggiorna il prestito a `4.828,00`
senza mutare automaticamente il record contabile; il trasferimento `60,00` sposta il saldo a
Directa senza entrare in entrate, uscite o risparmio. L’aggiornamento investimento da `1.000,00 /
1.125,00` a `1.060,00 / 1.200,00` produce gain `140,00` e `13,20%`.

Risultati finali: conto operativo `9.468,00`, Directa `60,00`, conto prestito `0,00`, totale ledger
`9.528,00`, disponibilità `9.468,00`; settembre `3.000,00 / 672,00 / 2.328,00 / 77,6%`, agosto
`2.800,00 / 600,00 / 2.200,00`, variazioni `+200,00 / +72,00 / +128,00` e trend spese `+12%`.
Il pannello “Debiti e investimenti” resta fuori dalla fascia KPI primaria e filtra la valuta EUR.

La suite dedicata contiene il percorso completo su tutti i sei profili, negativo a 390 px e prova
IndexedDB offline a 1440 px con creazione, modifica, reload e riapertura. Dopo offline non compaiono
duplicati; console e `pageerror` restano vuoti. Le asserzioni tastiera/focus e target interattivi
misurano 44×44 px; il controllo globale `icon-button` è stato adeguato da 40×40 a 44×44 px.
P0/P1/P2: `0/0/0`.

P0 aperti: Nessuno
P1/P2 aperti: Nessuno
Esito: PASS
