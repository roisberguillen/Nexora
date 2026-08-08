# Matrice schermate Stitch e superfici Nexora

## Scopo e fonte

Questa matrice chiude la Fase 1 della roadmap UI. Collega le 98 schermate PNG contenute in
`C:\Users\Roi23\Downloads\stitch_file_instruction_processor` alle route e ai contratti già
presenti, senza adottare il markup `code.html` come codice di produzione. La fonte è verificata
con l'hash dell'archivio registrato in [STITCH_UI_REFERENCE.md](STITCH_UI_REFERENCE.md).

Le colonne **letture** e **scritture** sono contratti dell'attuale `LedgerRepository`: la UI non
deve interrogare direttamente gli adapter SQLite, OPFS o IndexedDB.

## Mappa delle superfici

| Famiglia Stitch (schermate) | Route/superficie Nexora | Letture | Scritture | Componenti target | Fase |
|---|---|---|---|---|---|
| `app_shell_desktop`, `app_shell_mobile` | shell globale | risultati ricerca già proiettati | navigazione e quick action | `AppShell`, `SidebarNavigation`, `TopHeader`, `MobileHeader`, `MobileBottomNavigation`, `QuickActionSheet` | 4 |
| `ricerca_globale_*` | ricerca globale nella shell | conti, categorie, tag, transazioni | nessuna | `GlobalSearch`, command palette desktop, ricerca full-screen mobile | 4 |
| `dashboard_desktop_*`, `dashboard_mobile_*`, `errore_caricamento_dati_desktop` | `#overview` e startup | conti, transazioni, transfer, prestiti, investimenti | seed dimostrativo esplicito | `Dashboard`, `MetricCard`, grafici accessibili, empty/loading/offline/error state | 5–6 |
| `conti_*`, `dettaglio_conto_mobile`, `nuovo_conto_mobile` | `#accounts` | `listAccounts`, `listTransactions` | create/update/archive/delete-empty account | lista conti, editor, dettaglio mobile | 6 |
| `movimenti_*`, `nuovo_movimento_*` | `#transactions`, `#new-transaction` | conti, categorie, tag, transazioni, transfer, split | manual transaction, transfer, cancel, trash, restore | tabella/lista, filtri, editor movimento, sheet mobile | 6 |
| `budget_*` | `#budgets` | budget, categorie, transazioni | create/update/delete budget | budget progress, editor, empty state | 12 |
| `ricorrenze_*`, `conferma_ricorrenza` | `#recurring` | recurring rules, conti, categorie | create/update/delete recurring rule | recurring list, editor, confirmation dialog | 12 |
| `allocazioni_*` | sezione `#recurring`, route dedicata da introdurre solo se necessaria | allocation plans, conti | create/update/delete plan, execute confirmed plan | allocation list, preview, confirmation | 12 |
| `prestiti_*`, `dettaglio_prestito_desktop` | `#loans` | accounts, loans | create/update/delete loan | loan cards, detail panel, empty state | 12 |
| `investimenti_*`, `nuovo_investimento_desktop` | `#investments` | accounts, investment positions | create/update/delete position | portfolio cards, editor, empty state | 12 |
| `analisi_*` | `#analytics` | transazioni non annullate e proiezioni | nessuna | trend chart, confronto periodi, empty state | 12 |
| `diario_finanziario_*` | `#journal` | monthly journals e proiezioni | save/update/delete journal | sintesi, riflessione, controllo 1–5 | 12 |
| `categorie_*`, `stato_vuoto_categorie`, `nuovo_elemento_categoria_tag`, `conferma_unione_categoria_tag` | `#categories` | categorie e riferimenti | create/update/archive/reactivate/delete/merge/move category | Macro categoria → Sottocategoria tree, editor, merge dialog | 12 |
| `tag_*`, `nuovo_elemento_categoria_tag`, `conferma_unione_categoria_tag` | `#tags` | tag e riferimenti | create/update/delete/merge/remove tag | tag list, editor, merge dialog | 12 |
| `importazione_*` | `#imports` | conti, categorie, batch, import rows, transazioni | preview, commit atomico, undo batch | import wizard, mapping table, validation summary, report | 8 |
| `esportazione_dati_*` | `#exports` | conti, categorie, transazioni | download locale, nessuna mutazione ledger | filter form, export choices, receipt | 8 |
| `gestione_backup_*`, `nuovo_backup_desktop`, `verifica_e_ripristino_backup_desktop`, `dettaglio_e_report_backup` | `#backup` | backup history e manifest | create/verify/restore portable archive | backup hub, history, verification report | 9–11 |
| `notifiche_*`, `preferenze_notifiche` | `#notifications` e impostazioni | budget, loans, recurring rules, transazioni | preferenze locali, acknowledgment | notification center, preferences | 12 |
| `profilo_*`, `privacy_e_sicurezza_*`, `app_lock_*` | `#profile`, `#privacy-security` | app lock e preferenze | configure/verify/lock | profile hub, privacy settings, PIN screen | 5, 12 |
| `cestino_*`, `reset_finanziario`, `reset_totale`, `report_reset_finale` | `#settings` | trashed transactions e reset preview | restore/purge/reset | trash list, destructive dialogs, receipt | 12 |
| `startup_*` | bootstrap, prima della shell | diagnostica, archivi recuperabili | retry, open safe copy, restore selection | loading, recovery, limited-mode state | 5 |

## Componenti: consolidazione obbligatoria

| Livello | Componenti correnti | Confine Fase 1 |
|---|---|---|
| Shell | `AppShell`, nav desktop/mobile, header, search, quick action | una sola shell responsive; route e stato di navigazione non vengono duplicati nelle pagine |
| Primitivi di visualizzazione | `FinancialAmount`, `MetricCard`, `NavIcon` | importi, stati semantici, focus e densità diventano token/componenti condivisi nella Fase 4 |
| Form e overlay | form locali nelle feature, `QuickActionSheet` | campi importo/data/select, dialog e drawer diventano componenti accessibili riusabili prima della riscrittura delle pagine |
| Feedback | `ErrorBoundary`, startup/recovery locali | loading, empty, offline, errore e successo usano contratti coerenti nella Fase 5 |
| Feature | pagine in `apps/web/src/*` | ricevono view model e comandi; non importano adapter di persistenza |

## Scostamenti rilevati e decisioni di sequenza

1. Le 98 schermate contengono stati, non 98 route nuove. Gli stati di caricamento, errore,
   offline, vuoto, conferma e report restano parte della superficie funzionale indicata sopra.
2. `#recurring` ospita oggi anche le allocazioni. La matrice non autorizza una route duplicata:
   la Fase 12 deciderà una route dedicata solo se necessaria per la navigazione mobile.
3. La ricerca Stitch richiede una command palette desktop e una superficie mobile dedicata; il
   motore di risultati corrente è condivisibile, l'interazione verrà rifatta nella Fase 4.
4. Le schermate backup non autorizzano NAS, SMB o directory di rete. Sono limitate a `.nexora`
   manuale e Google Drive secondo ADR 0018.
5. I mockup illustrano dati sintetici. Gli adapter e le invarianti del ledger restano la fonte
   esclusiva dei dati in produzione.

## Criteri di accettazione per le fasi successive

- Ogni schermata implementata deve riferire questa matrice e il relativo viewport Stitch.
- I test includono almeno 320, 390, 768 e 1440 CSS px, tastiera e focus visibile.
- Gli stati vuoto, loading, errore e offline non possono essere sostituiti da dati fittizi.
- Le modifiche visuali non possono cambiare letture, scritture o invarianti elencate nella tabella.
