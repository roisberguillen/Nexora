# Nexora C3.0 — Framework audit schermata-per-schermata

## Scopo e gate

Questo documento prepara le review C3.1–C3.21. C3.0 è documentale: non corregge problemi UI e
non modifica React, TypeScript applicativo, CSS/SCSS, dominio, database, repository, import,
backup, Tauri o test funzionali. Le schermate sono superfici e stati, non nuove route.

Priorità: mobile (320, 375, 390 CSS px), tablet (768 px), desktop (1024, 1440 px). Ogni review
usa dati sintetici o fixture esistenti, non dati reali, e collega ogni rilievo a route, viewport,
stato, evidence e correzione proposta.

## Inventario definitivo

| # | Superficie/stato | Route o contenitore reale |
| ---: | --- | --- |
| 1 | App Shell | `shell` |
| 2 | Navigazione mobile | `shell` |
| 3 | Navigazione desktop | `shell` |
| 4 | Ricerca globale | `#search` nella shell |
| 5 | Dashboard/Home | `#overview` |
| 6 | Conti | `#accounts` |
| 7 | Dettaglio conto | `#accounts` + stato dettaglio |
| 8 | Nuovo conto | `#accounts` + stato editor |
| 9 | Movimenti | `#transactions` — regression review C3.5 |
| 10 | Nuovo movimento | `#new-transaction` |
| 11 | Budget | `#budgets` |
| 12 | Ricorrenze | `#recurring` |
| 13 | Allocazioni | `#recurring` + stato allocazioni |
| 14 | Prestiti | `#loans` |
| 15 | Investimenti | `#investments` |
| 16 | Analisi | `#analytics` |
| 17 | Diario finanziario | `#journal` |
| 18 | Categorie | `#categories` |
| 19 | Tag | `#tags` |
| 20 | Importazione | `#imports` |
| 21 | Esportazione | `#exports` |
| 22 | Backup | `#backup` |
| 23 | Restore | `#backup` + stato verifica/ripristino |
| 24 | Notifiche | `#notifications` |
| 25 | Preferenze notifiche | `#notifications` + impostazioni |
| 26 | Profilo | `#profile` |
| 27 | Privacy/Sicurezza | `#privacy-security` |
| 28 | App Lock | `#privacy-security` + stato lock |
| 29 | Impostazioni | `#settings` |
| 30 | Cestino | `#settings` + stato cestino |
| 31 | Reset finanziario | `#settings` + dialog/reset |
| 32 | Reset totale | `#settings` + dialog/reset |
| 33 | Startup | `bootstrap` |
| 34 | Recovery | `bootstrap` + stato recovery |

La matrice Stitch resta la fonte per il mapping delle famiglie e conferma che gli stati non
diventano route artificiali. Allocazioni restano in `#recurring` salvo decisione futura motivata.
Backup/restore restano limitati ai formati supportati (`.nexora` e Google Drive selezionato); NAS,
SMB e backup agent sono fuori prodotto.

## Sequenza ufficiale

| Fase | Audit |
| --- | --- |
| C3.1 | App Shell + Navigazione mobile/desktop |
| C3.2 | Ricerca globale |
| C3.3 | Dashboard/Home |
| C3.4 | Conti |
| C3.5 | Movimenti — regression review soltanto |
| C3.6 | Budget |
| C3.7 | Ricorrenze + Allocazioni |
| C3.8 | Prestiti |
| C3.9 | Investimenti |
| C3.10 | Analisi |
| C3.11 | Diario finanziario |
| C3.12 | Categorie |
| C3.13 | Tag |
| C3.14 | Importazione |
| C3.15 | Esportazione |
| C3.16 | Backup + Restore |
| C3.17 | Notifiche |
| C3.18 | Profilo |
| C3.19 | Privacy/Sicurezza + App Lock |
| C3.20 | Impostazioni + Cestino + Reset |
| C3.21 | Startup + Recovery |

C3.0 non avvia nessuna fase della sequenza. Movimenti entra in C3.5 con il precedente
`TRANSACTIONS_GATE_PASS`; non si ripete il lavoro C2 e non si fa redesign.

## Checklist comune obbligatoria

Il reviewer copia il template C3 e registra risultato/evidence per ogni gruppo applicabile.

- **Funzionalità:** apertura, dati reali del view model, CTA, create/update/delete, conferma,
  annulla, back e assenza di affordance inesistenti.
- **Mobile:** leggibilità, gerarchia, uso con una mano, header, bottom navigation, CTA, filtri,
  sheet, dialog, scroll, tastiera virtuale, safe area e touch target `>=44×44 px`.
- **Desktop:** sidebar, top bar, densità, tabelle, pannelli, detail panel, azioni e navigazione
  tastiera; nessuna funzione mobile mancante senza decisione documentata.
- **Responsive:** 320/375/390/768/1024/1440; overflow, wrapping, clipping, importi, tabelle,
  card, CTA, overlay e layout instabile.
- **Zoom:** browser reale al 200%; reflow, testo, form, dialog, sheet, scroll e perdita di
  funzionalità. Il viewport ristretto da solo non vale come prova di zoom.
- **Accessibilità:** keyboard-only, focus visibile/return/trap, accessible name, label, heading,
  error association, contrasto, screen-reader basics, dialog/form semantics e colore non unico
  indicatore.
- **Stati:** loading, empty, filtered-empty, error, offline, disabled, success e destructive
  confirmation quando applicabili.
- **Edge case:** testi e nomi lunghi, importi elevati, molti record, lista vuota, dati parziali,
  errori e azioni non disponibili.
- **Coerenza:** design system, Stitch ufficiale, componenti condivisi, token, tipografia,
  spacing, icone e formattazione monetaria; accessibilità/responsive prevalgono sul pixel-perfect.

### Domande mobile-first da riportare nella review

1. Il contenuto prioritario è visibile subito?
2. La CTA primaria è raggiungibile con una mano?
3. Esistono elementi troppo piccoli?
4. La tastiera copre input o CTA?
5. La bottom navigation copre contenuti?
6. La safe area è rispettata?
7. Ci sono tabelle desktop semplicemente compresse?
8. Il dettaglio usa un pattern adatto al mobile?
9. Dialog e sheet sono realmente utilizzabili?
10. Esiste overflow orizzontale?
11. Importi e descrizioni rimangono leggibili?

### Gate desktop

La review risponde anche se la pagina sfrutta lo spazio, sidebar e contenuto non competono, tabelle
e detail panel restano leggibili, azioni e toolbar sono riconoscibili, keyboard navigation e focus
funzionano e nessuna funzione prevista è persa.

## Severità e decisione

- **P0 — Bloccante:** perdita/corruzione dati, azione finanziaria errata, superficie inutilizzabile,
  percorso fondamentale impossibile o grave violazione di sicurezza.
- **P1 — Rilevante:** funzione importante inutilizzabile, layout mobile rotto, CTA irraggiungibile,
  overflow critico, tastiera/focus che impediscono l’uso o UI incoerente con la funzione reale.
- **P2 — Miglioramento:** difetto visivo minore, spacing o rifinitura non funzionale.

P0 o P1 aperto produce `SCREEN_AUDIT_BLOCKED`. `SCREEN_AUDIT_PASS` richiede P0=0, P1=0, test
richiesti verdi, mobile/tablet/desktop verificati, accessibilità verificata ed evidence aggiornata.
P2 può restare aperto solo se elencato e non blocca l’uso.

Una modifica visuale richiede almeno una prova browser verificabile: Playwright/browser automation,
screenshot di review o controllo headed/manuale documentato. CSS letto, snapshot o assunzione teorica
non bastano. Naming screenshot, solo quando aggiungono prova: `c3-<fase>-<screen>-<viewport>-<state>.png`.

## Test strategy e freeze

Partire dal livello minimo proporzionato: (1) test componente/file, (2) integration feature,
(3) format/lint/typecheck/unit/build, (4) E2E/browser/accessibility quando il rischio lo richiede.
Per UI significativa il browser è obbligatorio; registrare comandi, conteggi, skip e failure.

Nessuna superficie passa con keyboard trap, focus invisibile, CTA irraggiungibile, dialog non
accessibile, input senza label, errori non associati, contrasto grave, zoom 200% inutilizzabile o
touch target fondamentale sotto 44 px. Dopo `SCREEN_AUDIT_PASS` la superficie è congelata C3 e si
può riaprire solo per regressione, problema cross-screen, P0/P1, accessibilità, sicurezza o
correttezza finanziaria; ogni redesign richiede una nuova decisione.

## Riferimenti e ownership

Ogni review collega `docs/ux/MOCKUP_INTEGRATION.md`, `docs/ux/STITCH_SCREEN_MATRIX.md`,
`docs/ux/STITCH_UI_REFERENCE.md`, `design/mockup/stitch/DESIGN.md`, il flusso pertinente e il
view model reale. `ui-reviewer` cura resa visiva/evidence, `ux-reviewer` flussi e accessibilità,
`qa-engineer` test automatici/manuali; `security-reviewer` entra solo per sicurezza, recovery,
privacy o backup. La matrice persistente `.codex/state/ui-screen-review-matrix.md` è il tracking.
