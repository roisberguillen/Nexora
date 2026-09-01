# 12.5.C3.17 — Notifications Mobile/Desktop audit

Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Notifications / Notifiche e preferenze avvisi
Route: `#notifications`
Flusso principale: apertura → lettura/dismiss → deep-link → ritorno alla superficie
Reviewer/fase: Codex — 12.5.C3.17
Modifiche: layout responsive, badge unread, azione di lettura, deduplica soglie e date/loan guard.
Data: 2026-09-01
Esito: PASS

## Contratto e derivazione

La UI renderizza esclusivamente `deriveLocalNotifications`; non replica soglie o date in React.
I tipi realmente presenti sono backup scaduto, recovery drill scaduto, saldo basso, budget threshold,
entrata ricorrente mancante, ricorrenza imminente e rata prestito imminente. Gli avvisi sono locali,
derivati dal ledger e non modificano dati finanziari. Le soglie Budget usano gli stessi valori e lo
stesso `calculateBudgetProgress` della BudgetPage; quando è raggiunta la seconda soglia viene emesso
solo il livello più grave. Ricorrenze disabilitate, prestiti con residuo zero o rate residue zero e
condizioni fuori finestra non generano alert.

Gli identificativi sono stabili per entità/periodo/data; la derivazione ripetuta produce lo stesso
insieme logico senza persistere copie. L’ordine resta deterministico per priorità, con inserimento
stabile del dominio. Le date civili sono calcolate in `Europe/Rome`, con `today` iniettato nei test.

## Stato, badge e navigazione

Lo stato persistito in localStorage contiene solo `readAt` e `dismissed`, indicizzati dall’ID stabile;
ledger e copie complete dei dati non vengono duplicati. Apertura di un deep-link e azione “Segna come
letta” marcano l’avviso letto; “Segna tutte come lette” aggiorna tutti gli avvisi visibili. Il badge
mostra il conteggio reale delle notifiche non lette e scompare a zero. “Ignora” nasconde l’istanza
corrente; la condizione derivata può riapparire con un nuovo ID di periodo/data. Le destinazioni sono
Budget, Ricorrenze, Prestiti, Conti e Backup secondo il tipo; il browser back torna alla superficie
precedente senza overlay persistenti.

## Privacy e sicurezza

Descrizioni e nomi di account/categoria sono renderizzati come testo React: nessun HTML unsafe e
payload XSS viene mostrato letteralmente. I contenuti non sono loggati, non sono inseriti negli URL
e non vengono inviati online. Le notifiche browser esistenti richiedono un’azione esplicita e non
introducono scheduler o push nativi; notifiche OS-native/background restano `DEFERRED TO PHASE 13`.

## Evidenza browser e responsive

- Browser locale: superficie `#notifications` verificata con DOM e screenshot su mobile 390 px e
  desktop 1440 px; corretto l’overlap iniziale dei pannelli dovuto all’assenza di layout/padding
  dedicato. Dopo la correzione: gerarchia, spaziature, badge e CTA leggibili.
- Matrice Playwright: 320, 375, 390, 768, 1024 e 1440 px; apertura, lista, dismiss/read,
  deep-link e scroll width verificati senza overflow.
- Zoom 200%: 1024 e 1440 CSS px equivalenti con CDP, axe e contenuto operativo PASS.
- Touch target, safe area, focus e navigazione tastiera rispettano la shell condivisa; axe non
  rileva violazioni nei flussi verificati.

## Mobile-first gate

| Area | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Gerarchia, priorità e significato | PASS | Priorità testuale, descrizione, data/periodo e CTA derivati dal dominio. |
| Mobile | Lista, badge, azioni e safe area | PASS | 320/375/390 px, no overflow, CTA e bottom navigation raggiungibili. |
| Desktop | Pannelli, densità e azioni | PASS | 1024/1440 px, pannelli allineati e controlli leggibili. |
| Tablet | Layout intermedio | PASS | 768 px verificato con lista, badge e deep-link. |
| Visuale | Coerenza Stitch | PASS | Token Nexora, Inter, superfici e spaziatura condivisi. |
| Ricerca | Ricerca notifiche | N/A | La superficie non espone ricerca; il controllo è registrato nel framework. |
| Form | Preferenza soglia saldo | PASS | Label, minor units, validazione e feedback accessibili. |
| Feedback | Read, dismiss, error e permission | PASS | Stati persistenti, empty state e permesso browser espliciti. |
| Accessibilità | Nomi, focus e axe | PASS | Bottoni nominati, focus visibile, target e axe verificati. |
| Finanza | Soglie, date e importi | PASS | Budget condiviso, timezone Rome, nessuna mutazione finanziaria. |
| Performance | Derivazione locale | PASS | Deduplica deterministica, no rete, limiti e build verificati. |

## Verifiche

| Area | Esito | Evidenza |
| --- | --- | --- |
| Correttezza alert | PASS | Budget, recurring, loan, backup, recovery e saldo derivati dal dominio. |
| Deduplica/staleness | PASS | Seconda soglia sostituisce la prima; derivazioni ripetute identiche; regole risolte escluse. |
| Read/unread/badge | PASS | Stato separato, mark read, mark all read, badge reale e persistenza. |
| Deep-link/back | PASS | Route Budget, Ricorrenze, Prestiti, Conti e Backup; back coerente. |
| Offline/privacy/XSS | PASS | Solo dati locali, nessun URL/log sensibile, React escaping e axe. |

## Rilievi

### P0

P0 aperti: Nessuno

### P1

Nessuno. Risolti: overlap/padding della superficie, doppio alert budget, lettura non persistita,
date Europe/Rome e alert su prestito estinto.

### P2

Nessuno aperto.

## Correzioni e test

- `apps/web/src/notifications/NotificationsPage.tsx`: badge unread, mark read prima del deep-link,
  comando singolo accessibile e grouping responsive delle azioni.
- `apps/web/src/notifications/localNotifications.ts`: livello budget più grave, guardia loan estinto
  e calcolo civil-date Europe/Rome.
- `apps/web/src/page.css`: layout, padding, spaziature, reflow e griglia allineata della lista
  specifici della superficie.
- Test unit/component: `14 passed` sui tre file Notifications.
- E2E C3.17: `14 passed`, `4 skipped` solo zoom non applicabile ai viewport 320/375/390/768.
- Regressione lista: azioni allineate a destra su desktop e disposte sotto il contenuto su mobile;
  overflow e axe restano PASS su tutti i viewport.
- Regressione post-freeze verificata il 2026-09-01: margini globali rimossi dai comandi della
  lista per mantenere allineamento coerente tra tutte le righe.
- Verifica Chrome post-regressione il 2026-09-01: colonne esplicite mantengono “Apri” e “Ignora”
  allineati anche nelle righe già lette; mobile a 390 px resta senza overflow.
- Gate completo `pnpm verify`: `138 passed`, `1 skipped`; `606 passed`, `4 skipped`; build PASS
  con advisory preesistente sui chunk oltre 500 kB.

## Conclusione

`SCREEN_AUDIT_PASS`

Notifications è congelata per la C3. Modifiche successive sono consentite soltanto per regressioni
dimostrate, P0/P1, correttezza degli alert, accessibilità, privacy o sicurezza.
