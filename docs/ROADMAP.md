# Roadmap Release Candidate

Fonte: `NEXORA_ROADMAP_RELEASE_CANDIDATE.md`, 29 luglio 2026. Nexora è in
`0.5.0-rc.1`; il passaggio a `1.0.0` è vietato finché tutte le fasi seguenti non sono provate
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

- [x] formato `.nexora-backup` cifrato canonico per SQLite/OPFS e IndexedDB;
- [x] restore incrociato, picker accessibile, verifica manifest/checksum e rollback;
- [x] test round-trip e corruzione su entrambi i backend.

## R3 — Cronologia e recovery drill

- [x] cronologia persistente di backup, restore e controlli;
- [x] recovery drill non distruttivo e avvisi temporali;
- [x] UI, test backend ed E2E equivalenti.

## R4 — Google Drive pronto per uso reale

- [x] stati OAuth espliciti, retry, timeout, disconnessione e diagnostica sicura;
- [x] upload/download registrati e verificati prima del restore;
- [x] mock CI e guida di configurazione reale.

## R5 — Notifiche finanziarie e operative

- [x] backup/restore scaduti, saldo basso ed entrata attesa mancante;
- [x] priorità, preferenze, deduplica e storico;
- [x] fallback interno senza Notifications API.

## R6 — Prestazioni, accessibilità e RC

- [x] benchmark 1k–100k per operazioni critiche;
- [x] audit Axe, tastiera, zoom e visual regression 320–1440;
- [x] checklist, report RC e quality gate completi.

Ogni fase resta non selezionata finché i rispettivi criteri sono verificati e pubblicati.
