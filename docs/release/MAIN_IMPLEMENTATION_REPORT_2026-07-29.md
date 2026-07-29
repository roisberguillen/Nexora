# Nexora — Main implementation report (2026-07-29)

## Identità della release

- **Branch:** `main`.
- **Commit iniziale:** `6fe25651f32d76a49ff5fa059050ef3b721161e0`.
- **Commit finale della release funzionale:**
  `42c611b9e5aa712b14999ec6c3ebcb4f15e384b2`, verificato contro `origin/main`.
- **Remote:** `https://github.com/roisberguillen/Nexora.git`.

## Milestone e pubblicazione

| Milestone | Commit | Stato push |
|---|---|---|
| M0 baseline | `d4e3311` | verificato su `origin/main` |
| M1 copertura distruttiva | `d4898cd` | verificato su `origin/main` |
| M2 reset finanziario | `691b2e2` | verificato su `origin/main` |
| M3 ripristino totale/cloud | `edf5a99` | verificato su `origin/main` |
| M4 cestino e selezione | `5c16ffc` | verificato su `origin/main` |
| M5 conti, categorie e tag | `13ac016` | verificato su `origin/main` |
| M6 gestione dati/accessibilità | `8fd1b6f` | verificato su `origin/main` |
| M7 hardening | `42c611b` | verificato su `origin/main` |

## Risultati verificati

- `pnpm doctor`: Node 24.15.0 e pnpm 11.9.0 compatibili; OPFS/FSA richiedono il browser reale;
  Google Drive non è configurato in questo ambiente.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm manifest:check` e
  `pnpm audit --prod`: verdi; nessuna vulnerabilità nota.
- Unit e integrazione: 257 test verdi prima del benchmark M7; i test mirati per SQLite,
  IndexedDB, snapshot, backup locale, rollback in memoria, reset e redazione log hanno aggiunto
  70 verifiche verdi.
- E2E: 116 verdi e 34 skip dichiarati su 320, 375, 768, 1024 e 1440 px. Gli skip duplicano test
  visuali/offline/OPFS/IndexedDB limitati intenzionalmente al profilo `chromium-1440`, l’unico
  che espone le API e le baseline necessarie; non mascherano un fallimento funzionale.
- Scansione pattern segreti: pulita; nessuna chiave AWS, GitHub, OpenAI o Google trovata fuori da
  dipendenze e `.git`.

## Benchmark M7 (repository in-memory, dati sintetici)

I tempi sono millisecondi sulla macchina Windows 11 della baseline; non sono SLA di un browser
reale. “Recovery” include decodifica e validazione completa dello snapshot portabile.

| Record | Selezione | Cestino | Purge | Categorie | Backup | Recovery | Reset | Heap finale |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1.000 | 0,34 | 0,29 | 12,58 | 2,36 | 4,52 | 19,94 | 0,53 | 99,49 MiB |
| 10.000 | 1,35 | 2,90 | 156,97 | 11,90 | 16,54 | 221,92 | 2,56 | 104,97 MiB |
| 50.000 | 3,44 | 14,73 | 987,29 | 47,50 | 89,28 | 1.042,32 | 8,96 | 212,80 MiB |
| 100.000 | 9,31 | 33,73 | 2.655,05 | 120,09 | 175,42 | 2.214,53 | 23,35 | 385,87 MiB |

Il benchmark verifica inoltre ripristino, purge, riassegnazione massiva, snapshot recuperabile e
reset con ricostruzione delle sole categorie di sistema. Non blocca il thread UI perché misura il
repository in-memory; la UI reale deve delegare persistenza e backup agli adapter disponibili.

## Persistenza e migrazioni

- SQLite/OPFS e IndexedDB condividono adapter testati per migrazioni additive, rollback atomico,
  cestino, trasferimenti, split, tag, import audit, backup e riapertura.
- Le migrazioni fino alla v13 preservano lo schema v1; le versioni additive includono split,
  tag, import, ricorrenze, budget, prestiti, investimenti, diario e dati del cestino.
- I test di snapshot e backup rifiutano payload incompleti, checksum incoerenti e schema non
  valido prima di modificare il ledger. Il recovery drill M7 conferma una validazione non
  distruttiva del backup logico.

## Funzioni verificate

- **Reset finanziario:** preview, backup cifrato o consenso distinto, PIN quando configurato,
  commit atomico, categorie di sistema e ricevuta priva di dati sensibili.
- **Ripristino totale e Drive:** reset locale indipendente dalla cancellazione cloud opzionale,
  doppia conferma e report di successo parziale; token OAuth solo in memoria e scope
  `drive.appdata`.
- **Cestino e cancellazione multipla:** gruppi transfer atomici, retention solo informativa,
  undo/restore, purge esplicita e audit import conservato.
- **Conti, categorie, tag:** svuotamento protetto, merge/rassegnazione atomica, categorie di
  sistema non distruttibili e deduplica tag.
- **Accessibilità:** dialog con focus trap, ritorno del focus, Escape, progressione, errori
  specifici e test Axe/tastiera sui viewport richiesti.

## Rischi residui e raccomandazione

- Il ledger del browser non è cifrato a riposo; i backup sono cifrati con passphrase.
- Google Drive richiede una configurazione OAuth del deployment ed è correttamente inattivo senza
  client ID; non esiste un servizio NAS di produzione.
- I benchmark di 100k misurano il repository in-memory, non il tempo di rendering o la memoria
  completa di Chromium; il recovery dello snapshot è il tratto più costoso e va monitorato su
  dispositivi meno potenti.

**Raccomandazione:** candidata al rilascio interno/RC, con backup verificato prima di qualunque
aggiornamento e con test su un browser target prima della distribuzione pubblica.
