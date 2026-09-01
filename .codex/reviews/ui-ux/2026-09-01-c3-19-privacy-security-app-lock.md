# NEXORA — Fase 12.5.C3.19

Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Privacy/Sicurezza + App Lock
Route: `#privacy-security`
Flusso principale: apertura → contratto privacy → attivazione/conferma → lock/unlock → disattivazione riautenticata → recovery
Reviewer/fase: Codex — 12.5.C3.19
Modifiche: conferma segreto, riautenticazione, fail-closed storage, anti-double-submit e isolamento shell.
Data: 2026-09-01
Esito: PASS

## Privacy / Sicurezza + App Lock — review Mobile/Desktop

- Route: `#privacy-security`
- Revisione: Codex — 2026-09-01
- Esito: `SCREEN_AUDIT_PASS / FROZEN`
- Matrice: Mobile 320/375/390, tablet 768, desktop 1024/1440

## Viewport ed evidence

- 320 / 375 / 390 px: Mobile — layout e controlli utilizzabili, nessun overflow.
- 768 px: Tablet — pannelli e form leggibili.
- 1024 / 1440 px: Desktop — allineamento coerente con shell e Stitch.
- Zoom browser 200%: verificato su desktop, contenuto e CTA utilizzabili.
- Keyboard-only, focus, safe area, touch `>=44×44 px`: label, autoFocus, submit, errori e recovery verificati.
- Browser/Playwright: `test/e2e/c3-security-app-lock.spec.ts`, 12 pass.

## Mobile-first gate

| Area | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Gerarchia, contratto e CTA | PASS | Privacy, App Lock, backup e recovery espliciti. |
| Mobile | Reflow, safe area e target | PASS | 320/375/390 px, nessun overflow. |
| Desktop | Densità e allineamento | PASS | 1024/1440 px, pannelli coerenti. |
| Tablet | Layout intermedio | PASS | 768 px verificato. |
| Visuale | Coerenza Stitch | PASS | Token, Inter e colori approvati invariati. |
| Ricerca | Ricerca quando bloccata | N/A | La shell e la ricerca non vengono renderizzate in lock. |
| Form | Conferma, errori e re-auth | PASS | Mismatch, PIN errato e disable protetto coperti. |
| Feedback | Lock, unlock e recovery | PASS | Stati busy, alert e frase di reset esplicita. |
| Accessibilità | Label, focus e axe | PASS | Controlli nominati e focus verificati. |
| Finanza | Isolamento ledger | PASS | App Lock non cifra né modifica il ledger. |
| Performance | Timeout e build | PASS | Timeout bounded, PBKDF2 e build verificati. |

## Contratto privacy

La pagina dichiara il backend locale attivo e non attribuisce al browser una cifratura a riposo
del ledger. Il testo chiarisce che App Lock protegge la superficie dell'app finché il segreto non
è verificato, ma non cifra il ledger e non protegge da chi può leggere o modificare lo storage del
browser. I backup `.nexora` restano cifrati AES-256-GCM con chiave PBKDF2 derivata dalla passphrase;
la passphrase non viene salvata. Google Drive riceve soltanto archivi cifrati in `appDataFolder` e
il token OAuth resta in memoria.

## App Lock

- Attivazione con PIN/passphrase di almeno 4 caratteri e conferma obbligatoria.
- Persistenza locale del solo record versionato con salt/verifier e timeout 1/5/15 minuti.
- PBKDF2 SHA-256 a 600.000 iterazioni, salt casuale di 16 byte e verifier di 32 byte; il segreto
  non compare nel JSON persistito né nei log.
- Lock manuale e timeout per inattività; refresh e accesso diretto a una route protetta riaprono la
  schermata di blocco.
- Sblocco con verifica del segreto e protezione dal doppio submit.
- Disattivazione con riautenticazione tramite PIN/passphrase corrente; cambio PIN non supportato,
  workflow esplicito: disattiva e riattiva.
- PIN dimenticato: nessun recupero del segreto e nessun backdoor; solo reset totale dopo la frase
  `RIPRISTINA NEXORA`, con backup Drive invariati.
- Record corrotto o storage illeggibile: fail-closed, senza esposizione automatica della shell.

## Isolamento e superfici sensibili

Quando l'app è bloccata non vengono renderizzati AppShell, navigazione, ricerca globale, quick
action, Dashboard, Movimenti o Notifiche; l'accesso diretto a route sensibili resta bloccato. Non è
stata osservata esposizione di dati sensibili prima della schermata di blocco nel percorso E2E.

## Verifiche

| Area | Risultato | Evidence |
| --- | --- | --- |
| Code review e threat analysis | PASS | Nessun P0/P1 aperto; P2 nessuno. |
| Funzionalità e CTA | PASS | Attivazione, lock, unlock, disable re-auth e recovery. |
| Mobile | PASS | 320/375/390 px. |
| Desktop | PASS | 1024/1440 px, incluso zoom 200%. |
| Responsive | PASS | Sei viewport, nessun overflow. |
| Stati UI | PASS | Setup, attivo, errore, lock e recovery. |
| Accessibilità | PASS | Label/focus/target e test browser. |
| Edge case | PASS | Doppio submit, storage corrotto/illeggibile e PIN errato. |
| Coerenza Nexora/Stitch | PASS | Layout, font e token approvati. |
| Ricerca | N/A | Superficie privacy non contiene ricerca; lock la nasconde. |
| Finanza | PASS | Nessuna modifica ai dati finanziari; backup/export separati. |
| Performance | PASS | Build e suite verdi. |

- Test unit/UI mirati C3.19: 9 pass.
- E2E App Lock: 12 pass su 320/375/390/768/1024/1440.
- `pnpm verify`: PASS — 615 pass, 4 skip; typecheck, lint, build e format PASS.
- `pnpm quality:ui-ux`, `pnpm test:ui-ux`, manifest e validazione Codex: PASS.
- Full E2E: 317 pass, 138 skip; 6 fallimenti preesistenti nel pilot ledger per locator Importo e
  una baseline screenshot Dashboard desktop non allineata. Il pilot isolato riproduce il problema;
  nessun errore appartiene ai test C3.19.
- Visual review: contenuto, controlli, focus, touch target e assenza di overflow verificati alle
  sei viewport; zoom 200% verificato sui percorsi desktop.

## Rilievi

### P0

P0 aperti: Nessuno

### P1

Nessuno.

### P2

Nessuno.

## Correzioni e test

- File modificati: `apps/web/src/security/PrivacySecurityPage.tsx`, `AppLockScreen.tsx`,
  `appLock.ts`, test security/UI/E2E e `page.css`.
- Documentazione: review C3.19, stato roadmap/matrice/evidenze e changelog aggiornati.
- Test automatici: `pnpm verify` PASS; E2E C3.19 `12 passed`; quality/manifest/orchestrator PASS.
- Test browser: route reale `#privacy-security`, sei viewport e zoom desktop 200%.
- Correzione post-freeze: il form di configurazione App Lock usa padding inline e inferiore
  coerente con i pannelli (`1.25rem`), verificato nel test responsive su tutte le viewport.

Riferimenti: mockup Stitch ufficiale via `docs/ux/MOCKUP_INTEGRATION.md`, framework C3 e contratto
privacy/security locale. I revisori indipendenti nominati dal framework non sono disponibili nel
workspace; la revisione applicata è quella disponibile di Codex con security skill.

## Limiti e fase successiva

Il browser localStorage non è secure storage nativo: un utente/processo con accesso al profilo
browser può leggere, alterare o cancellare i dati locali. Restano fuori C3.19 e sono demandati a
Phase 13: OS keychain/Credential Manager, biometria, lifecycle lock nativo, protezione del processo
browser e notifiche native privacy-aware. Non viene dichiarata cifratura del ledger tramite App Lock.

`P0=0 · P1=0 · P2=0`

## Conclusione

`SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Privacy/Sicurezza e App Lock sono `FROZEN` per C3.

`UI_REVIEW_PASS`
