# UI/UX screen review — Nexora Backup + Restore

Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Backup + Restore
Route: #backup
Flusso principale: passphrase → backup cifrato verificato → selezione archivio → verifica read-only → preview → conferma restore
Reviewer/fase: Codex — 12.5.C3.16
Modifiche: preview verificata con riepilogo contenuti e lock anti-doppio-submit; test e documentazione C3.16.
Data: 2026-09-01
Esito: PASS

## Contratto backup reale

Il browser usa il `PortableBackupEngine` con payload `ledger.json` cifrato. Il snapshot contiene
accounts, categories, tags, transactions, transfers, recurringRules, allocationPlans, budgets,
loans, investmentPositions, monthlyJournals e importBatches, oltre alle relazioni splits,
transactionTags e importRows. Settings, notifiche, credenziali, token, chiavi e device secrets
non fanno parte del contratto. Il backup è distinto dall’Export e dal Local Hub.

Schema: formato archivio `1`, snapshot portabile `1`, schema ledger corrente `20`; schemi futuri
sono rifiutati prima della scrittura. Gli snapshot legacy supportati vengono normalizzati per le
revisioni Budget; non è previsto best-effort per formati sconosciuti.

## Integrità e restore

- AES-256-GCM con PBKDF2-HMAC-SHA-256, salt 128 bit, IV 96 bit e 600.000 iterazioni; passphrase
  non persistita e nessun segreto nei log o nei filename.
- Manifest autenticato con dimensione, SHA-256 del payload, versione, schema e timestamp UTC;
  file vuoti, corrotti, manomessi, oversized o con passphrase errata sono rifiutati.
- La verifica decifra/valida il payload senza scritture e mostra file, schema, data, checksum e
  conteggio di conti, movimenti, categorie e tag.
- La conferma dichiara la sostituzione del ledger corrente. Il restore usa `replacePortableSnapshot`
  atomico su IndexedDB e SQLite; in caso di errore post-write il motore ripristina e confronta un
  checkpoint in memoria. Le relazioni e gli ID vengono preservati.
- Il lock UI locale/cloud impedisce doppio submit durante creazione, verifica e restore.

## Evidenza browser e responsive

- Playwright reale: 390 e 1440 px, pagina #backup; download, verifica, preview, dialog con focus,
  annullamento, overflow e axe PASS.
- Matrice layout: 320 / 375 / 390 mobile, 768 tablet, 1024 / 1440 desktop; CTA, warning e
  preview restano leggibili e raggiungibili. Zoom 200% desktop coperto dal gate responsive.
- Il tab in-app a 5173 non era raggiungibile durante il controllo manuale perché il server locale
  era spento; il server è stato riavviato ma la policy browser ha mantenuto il tab d’errore. Nessun
  dato locale è stato modificato; l’evidenza visuale equivalente è quella E2E sulla preview 4173.

## Mobile-first

| Area | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Gerarchia e flusso | PASS | Backup, verifica, preview e restore hanno ordine e conseguenze comprensibili. |
| Mobile | Layout e CTA | PASS | 320/375/390 px, safe area, dialog e CTA verificati senza overflow. |
| Desktop | Layout e CTA | PASS | 1024/1440 px, preview, warning e dialog verificati. |
| Tablet | Layout intermedio | PASS | 768 px verificato nella matrice responsive. |
| Visuale | Coerenza Stitch | PASS | Spaziature, pannelli, tipografia e stati seguono i token Nexora. |
| Ricerca | Raggiungibilità | N/A | La superficie non contiene ricerca; il controllo è registrato nel framework. |
| Form | Passphrase e picker | PASS | Input protetto, file picker, validazione e conferma sono verificati. |
| Feedback | Stati operativi | PASS | Loading, errori, successo, annullamento e preview sono coperti. |
| Accessibilità | Tastiera e focus | PASS | Focus dialog, axe, target touch e navigazione tastiera sono coperti. |
| Finanza | Integrità valori | PASS | Minor units/bigint, ID e relazioni sono preservati nel round-trip. |
| Performance | Limiti e offline | PASS | Limiti payload, operazioni locali e gate build/verify sono passati. |

## Verifiche

| Area | Esito | Evidenza |
| --- | --- | --- |
| Backup non vuoto/read-only | PASS | archivio riletto, checksum e decrypt verificati; UI non scrive il ledger |
| Schema/compatibilità | PASS | versione corrente, legacy budget e schema futuro coperti dai test |
| Round-trip | PASS | IndexedDB → SQLite e IndexedDB → IndexedDB; importi bigint, date, stato e relazioni |
| Atomicità/recovery | PASS | failure post-write con rollback verificato; SQLite/IndexedDB atomici |
| Sicurezza | PASS | AES-GCM, tamper/wrong passphrase/malformed safe, no secrets/logging |
| UX/accessibilità | PASS | preview, conferma forte, Annulla, focus dialog, axe, target e responsive |
| Cloud | PASS | solo Drive appData, archivio già cifrato; auth/token restano in memoria |

## Mobile-first gate

Backup cifrato, warning non-crittografico, file picker, preview e conseguenza distruttiva sono
comprensibili. La password usa input protetto e autocomplete `new-password`; show/hide e clipboard
non sono previsti dal contratto corrente. Dialog e CTA non escono dallo schermo né dalla safe area.

## Correzioni

- `packages/database/src/backup/PortableBackupEngine.ts`: sintesi tipizzata del contenuto nella
  ricevuta verificata, senza modificare il formato o la crittografia.
- `apps/web/src/backup/BackupPage.tsx`: preview dei conteggi, avviso esplicito di sostituzione e
  lock sincrono comune per operazioni locali e Drive.
- Test component/e2e aggiornati per conteggio preview e contratto ricevuta.

## Rilievi

P0 aperti: Nessuno

P1 aperti: Nessuno

P2 aperti: Nessuno

## Test

- Mirati Backup/database/UI: `34 passed`, `0 failed`.
- E2E Backup + Restore: `4 passed`, `2 skipped` motivati perché il round-trip reale viene eseguito
  una sola volta su desktop; layout mobile resta verificato.
- Gate completo: `pnpm verify` — 138 file, 602 test passed, 1 file skipped e 4 skip documentati;
  build PASS con advisory preesistente sui chunk oltre 500 kB.
- `manifest:check`, `codex:validate` e checklist UI/UX sono passati dopo l’aggiornamento
  di questa review.

## Conclusione

`SCREEN_AUDIT_PASS`

Backup + Restore è congelata per la C3. Modifiche successive sono consentite soltanto per
regressioni dimostrate, P0/P1, sicurezza, compatibilità schema o integrità dati.
