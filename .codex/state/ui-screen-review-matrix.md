# Nexora C3 screen audit tracking

Authoritative inventory: `docs/ux/C3_SCREEN_AUDIT_FRAMEWORK.md`, cross-checked with
`docs/ux/STITCH_SCREEN_MATRIX.md` and current routing. This is a C3 tracking registry: no row is
PASS without a completed C3 review and browser evidence. Movimenti retains its C2 provenance but
is not pre-approved for C3; C3.5 is regression review only.

Allowed review results: `SCREEN_AUDIT_PASS`, `SCREEN_AUDIT_BLOCKED`. Tracking status before review:
`NEXT` or `PENDING`.

| Fase | Superficie/stato | Route | Mobile | Desktop | A11y | Funzioni | P0 | P1 | P2 | Stato |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| C3.1 | App Shell | shell | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.1 | Navigazione mobile | shell | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.1 | Navigazione desktop | shell | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.2 | Ricerca globale | #search | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.3-R4 | Dashboard/Home | #overview | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS / FROZEN |
| C3.4 | Conti | #accounts | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.4 | Dettaglio conto | #accounts + editor reale | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.4 | Nuovo conto | #accounts + editor | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.5 | Movimenti (regression review) | #transactions | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.5 | Nuovo movimento | #new-transaction | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.6 | Budget | #budgets | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS |
| C3.7 | Ricorrenze | #recurring | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS / FROZEN |
| C3.7 | Allocazioni | #recurring + allocazioni | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS / FROZEN |
| C3.8 | Prestiti | #loans | PASS | PASS | PASS | PASS | 0 | 0 | 0 | PASS / FROZEN |
| C3.9 | Investimenti | #investments | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.10 | Analisi | #analytics | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.11 | Diario finanziario | #journal | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.12 | Categorie | #categories | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.13 | Tag | #tags | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.14 | Importazione | #imports | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.15 | Esportazione | #exports | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.16 | Backup | #backup | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.16 | Restore | #backup + restore | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.17 | Notifiche | #notifications | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.17 | Preferenze notifiche | #notifications + impostazioni | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.18 | Profilo | #profile | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.19 | Privacy/Sicurezza | #privacy-security | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.19 | App Lock | #privacy-security + lock | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.20 | Impostazioni | #settings | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.20 | Cestino | #settings + cestino | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.20 | Reset finanziario | #settings + reset | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.20 | Reset totale | #settings + reset | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.21 | Startup | bootstrap | — | — | — | — | 0 | 0 | 0 | PENDING |
| C3.21 | Recovery | bootstrap + recovery | — | — | — | — | 0 | 0 | 0 | PENDING |

`—` significa non ancora verificato, non PASS. Le colonne P0/P1/P2 iniziano a zero perché non
sono ancora stati aperti rilievi C3; non anticipano il risultato della review.

## Review layer contract

Ogni riga `PASS` deve avere nel report collegato tutti i livelli seguenti; la matrice non considera
un test automatico come prova visuale:

| Layer | Evidenza minima | Gate |
| --- | --- | --- |
| Code | Source inspection e criteri verificati | `Code review: PASS` |
| Automated | Test browser automatici e risultato | `Automated browser verification: PASS` |
| Visual | Route reale, viewport 320/375/390/768/1024/1440, zoom 200%, interazioni ed evidenza renderizzata | `Visual browser verification: PASS` |
| Final review | P0 chiusi e report completo | `UI_REVIEW_PASS` |
