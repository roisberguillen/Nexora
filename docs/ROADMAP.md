# Roadmap Release Candidate

Fonte: `NEXORA_ROADMAP_RELEASE_CANDIDATE.md`, 29 luglio 2026. Nexora è in
`0.5.0-beta.1`; il passaggio a `1.0.0` è vietato finché tutte le fasi seguenti non sono provate
con codice, test, quality gate, commit e push.

## R0 — Riallineamento del progetto

- [x] Documentazione, versioning, toolchain e CI coerenti;
- [x] `pnpm doctor` verifica ambiente e configurazione non sensibile;
- [x] roadmap pre-release archiviata.

## R1 — Protezione dei dati locali e trasparenza privacy

- [x] Stato di cifratura del ledger documentato senza affermazioni fuorvianti;
- [x] pagina Privacy e sicurezza, redazione log e blocco applicazione opzionale;
- [x] test sicurezza, timeout e accessibilità.

## R2 — Backup equivalente

- [ ] formato `.nexora-backup` cifrato canonico per SQLite/OPFS e IndexedDB;
- [ ] restore incrociato, picker accessibile, verifica manifest/checksum e rollback;
- [ ] test round-trip e corruzione su entrambi i backend.

## R3 — Cronologia e recovery drill

- [ ] cronologia persistente di backup, restore e controlli;
- [ ] recovery drill non distruttivo e avvisi temporali;
- [ ] UI, test backend ed E2E equivalenti.

## R4 — Google Drive pronto per uso reale

- [ ] stati OAuth espliciti, retry, timeout, disconnessione e diagnostica sicura;
- [ ] upload/download registrati e verificati prima del restore;
- [ ] mock CI e guida di configurazione reale.

## R5 — Notifiche finanziarie e operative

- [ ] backup/restore scaduti, saldo basso ed entrata attesa mancante;
- [ ] priorità, preferenze, deduplica e storico;
- [ ] fallback interno senza Notifications API.

## R6 — Prestazioni, accessibilità e RC

- [ ] benchmark 1k–100k per operazioni critiche;
- [ ] audit Axe, tastiera, zoom e visual regression 320–1440;
- [ ] checklist, report RC e quality gate completi.

Ogni fase resta non selezionata finché i rispettivi criteri sono verificati e pubblicati.
