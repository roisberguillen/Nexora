# Piano di implementazione UI mobile

## Stato rilevato

Nexora è un monorepo `pnpm` TypeScript strict, composto dall'app React/Vite/PWA
`apps/web` e dai package `domain`, `database`, `importers`, `ui` e `config`.
L'app è local-first: il ledger viene aperto con SQLite WASM su OPFS, con fallback
esplicito a IndexedDB esclusivamente quando OPFS non è disponibile. Le operazioni
finanziarie sono già esposte da command layer dedicati e le pagine desktop esistenti
sono la fonte funzionale da riutilizzare.

La shell desktop, la sidebar, l'header di ricerca, le principali route e le pagine
gestionali sono presenti. La prima tranche della UI mobile ha già introdotto header,
bottom navigation, sheet delle azioni rapide, profilo, preferenze locali e la route
per la nuova registrazione. Restano da rendere omogenee le pagine secondarie,
l'analisi a tab, il centro notifiche locale e i dettagli mobili dei movimenti.

## Componenti da modificare

- `App.tsx`: routing hash, destinazioni delle azioni rapide e composizione delle
  pagine mobili senza cambiare i comandi finanziari;
- `AppShell.tsx`, `SidebarNavigation.tsx`, `TopHeader.tsx` e `styles.css`: shell
  responsive, safe area, focus e persistenza della navigazione;
- `TransactionsPage.tsx`: flusso unificato Entrata/Uscita/Trasferimento e resa a
  card sui viewport stretti;
- `AnalyticsPage.tsx`, `BackupPage.tsx` e le pagine gestionali esistenti: riuso
  dei dati reali con layout adatto a mobile;
- `page.css`: regole responsive specifiche della web app, senza degradare desktop.

## Componenti da creare o consolidare

- `MobileHeader`, `MobileBottomNavigation` e `QuickActionSheet` nel package UI;
- `MobilePageHeader` e controlli a segmenti/tab quando il riuso riduce duplicazioni;
- `NotificationsPage` e storage tipizzato del solo stato letto/dismiss delle
  notifiche derivate dai dati locali;
- test componenti e Playwright per navigazione, azioni rapide, preferenze e
  viewport.

## Route

Le route desktop esistenti restano invariate. Le route mobili aggiunte o da
consolidare sono `#profile`, `#settings`, `#notifications`, `#new-transaction`,
`#analytics-summary`, `#analytics-budget`, `#analytics-assets` e
`#analytics-journal`.

## Funzioni e vincoli riutilizzati

La UI deve invocare i command layer reali per conti, movimenti manuali,
trasferimenti, annullamenti, ricorrenze, prestiti, investimenti e diario. Gli
importi restano in minor units `bigint`; i trasferimenti rimangono atomici e non
contribuiscono a entrate/spese. Split, batch di importazione, annullamenti,
persistenza OPFS/IndexedDB e backup locale non vengono duplicati nella UI.

Google Drive non è rappresentato come backup operativo in questa slice: la UI
espone unicamente backup e restore locali realmente disponibili.

## Strategia responsive e accessibilità

- Mobile sotto 768 px: header e barra inferiore, card verticali, niente overflow
  orizzontale, safe area e target da almeno 44 px;
- Tablet da 768 a 1023 px: layout a colonne solo quando il contenuto lo consente;
- Desktop da 1024 px: sidebar, header e densità informativa esistenti preservati.

Dialog e sheet hanno semantica, Escape, focus trap e ritorno del focus; navigazione,
tab e controlli presentano label persistenti, stato attivo e focus visibile. Tema e
riduzione animazioni restano preferenze locali, versionate e separate dal ledger.

## Strategia test

Ogni route e comando UI aggiunto riceve test Vitest/Testing Library; gli E2E
Playwright coprono viewport 320/768/1440, quick sheet, navigazione, registrazione,
preferenze, backup locale e assenza di affordance cloud operative. I quality gate
sono `pnpm verify`, `pnpm test:e2e` e `pnpm manifest:check`.

## Sequenza

1. consolidare shell, route e design tokens mobili;
2. completare flusso nuova registrazione e collegamenti rapidi alle pagine esistenti;
3. adattare Home, Movimenti e Analisi ai viewport mobili;
4. completare Profilo, Impostazioni, Backup locale e Centro notifiche;
5. chiudere responsive/accessibilità, E2E, documentazione e quality gate.
