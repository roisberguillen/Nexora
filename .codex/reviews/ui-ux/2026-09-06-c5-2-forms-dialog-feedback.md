# 12.5.C5.2 — Form, dialog, feedback e system states

Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Fase: 12.5.C5.2
Schermata: Form e stati interattivi cross-surface
Route: `#transactions`, `#accounts`, `#budgets`, `#recurring`, `#loans`, `#investments`, `#categories`, `#tags`, `#journal`, `#profile`, `#privacy-security`, `#settings`, `#backup`
Data: 2026-09-06
Reviewer/fase: Codex — UI/UX + QA, 12.5.C5.2
Flusso principale: audit form/overlay/stati → guard double-submit → busy semantics → test mirati → E2E responsive → gate completo
Modifiche: aggiunto il contratto `aria-busy` ai form mutativi principali; Budget e Categorie ora proteggono il submit ravvicinato con `isSaving` e disabilitano la CTA durante la persistenza. Nessuna modifica a dominio, persistenza, Money, date semantics o recovery architecture.
Esito: PASS
Framework: `docs/ux/C5_CROSS_SURFACE_CONSISTENCY_FRAMEWORK.md`
Branch: `codex/phase-12-5-0-checkpoint`
Risultato: `12.5.C5.2 COMPLETE`; prossimo `12.5.C5.3`

## Audit e decisioni

- `C5-201 CLOSED`: Budget e Categorie avevano un gap reale di double-submit/busy state. Il guard
  resta locale al componente, conserva il form su errore e non altera i comandi sottostanti.
- `C5-202 CLOSED`: il segnale accessibile `aria-busy` è ora presente sui form mutativi principali:
  Movimenti, Conti, Budget, Ricorrenze, Allocazioni, Prestiti, Investimenti, Categorie, Tag,
  Diario, Profilo e App Lock.
- Dialog, drawer, bottom sheet, offline banner, success/error feedback e retry esistenti sono
  stati verificati e riusati; non è stata introdotta una nuova astrazione perché non c’era un
  pattern equivalente incompleto da consolidare.
- Importi, date, select, validazione dominio, conferme distruttive e recovery restano invariati;
  le differenze residue appartengono a C5.3/C5.4 e sono registrate senza interventi fuori scope.

## Browser evidence

- Browser locale reale verificato su `#budgets` e shell form a 390 px: form con `aria-busy="false"`
  a riposo, CTA raggiungibile, `scrollWidth === clientWidth`, nessun errore console.
- Responsive E2E delle superfici Budget, Categorie, Tag, Prestiti, Investimenti e Ricorrenze:
  63 passati, 15 skip condizionati, 0 failure sui profili 320/375/390/768/1024/1440.
- Zoom 200% desktop coperto dai test esistenti Budget/Categorie/Tag; gli skip sono dichiarati dal
  progetto e limitati ai profili non desktop.

## Test e gate

- Test mirati: 6 file, `27 passed`, `0 failed`, inclusi due test di double-submit e `aria-busy`.
- `pnpm verify`: primo run con un failure intermittente isolato di focus in Transactions; il test
  isolato è passato e il retry completo è verde: 140 file passati, 1 skip; 632 test passati, 4
  skip; build verde.
- `pnpm manifest:check`, `pnpm codex:validate`, `pnpm format:check`, `pnpm test:ui-ux`,
  `pnpm quality:ui-ux` e `git diff --check` eseguiti prima del commit.

| Area | ID | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | U-02 | PASS | C5-201/C5-202 chiusi nella matrice. |
| Mobile | M-02 | PASS | Form e CTA raggiungibili a 320/375/390/768 senza overflow. |
| Desktop | D-02 | PASS | Form mutativi e busy semantics verificati a 1024/1440. |
| Tablet | T-02 | PASS | Responsive E2E a 768 verde. |
| Visuale | V-02 | PASS | Pattern form esistenti preservati; nessun token o layout ridisegnato. |
| Ricerca | R-02 | N/A | Nessuna superficie di ricerca modificata; contratto C5.1 invariato. |
| Form | F-02 | PASS | `aria-busy`, CTA disabilitata e guard double-submit verificati. |
| Feedback | FB-02 | PASS | Busy, error, success, offline e retry esistenti preservati. |
| Accessibilità | A-02 | PASS | `aria-busy`, labels, alert/status e test double-submit verificati. |
| Finanza | FN-02 | PASS | Nessuna modifica a minor units, segni, valuta o command layer. |
| Performance | P-02 | PASS | Nessun nuovo componente/dependency; build con solo warning chunk preesistente. |

P0 aperti: Nessuno
P1 aperti: Nessuno
P2 aperti: Nessuno

## Stato finale

`12.5.C5.2 COMPLETE`. Nessuna nuova feature introdotta. La prossima attività è
`12.5.C5.3` — Componenti finanziari e rappresentazione dati; non avviata.
