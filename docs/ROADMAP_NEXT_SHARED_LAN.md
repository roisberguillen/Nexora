# Roadmap proposta — Nexora condivisa tra smartphone e desktop

Stato: **in corso — approvata il 30 luglio 2026**.

## Obiettivo

Consentire a smartphone e PC di usare lo stesso ledger attraverso un servizio locale di rete, mantenendo modalità offline e proprietà dei dati locali.

## M1 — Decisione architetturale e threat model

- [x] Definire server locale, binding LAN esplicito, autenticazione per dispositivo e cifratura in transito.
- [x] Stabilire ownership del ledger, backup e recovery in caso di indisponibilità host.
- [x] ADR per replica/sync, conflitti, idempotenza e migrazioni.
- [x] Test: pairing rifiutato, token scaduto, host non affidabile, accesso non autorizzato.

## M2 — API locale sicura

- Implementare API versionata con health check, ledger metadata e autenticazione.
- Non esporre server a interfacce pubbliche per default; richiedere consenso per LAN.
- CORS/CSP, rate limiting, audit tecnico non sensibile e protezione CSRF/origin.
- Test integrazione PC↔client LAN, riavvio host e permessi.

## M3 — Sincronizzazione e conflitti

- Log operazioni con idempotency key e cursore incrementale.
- Push/pull, retry offline, gestione conflitti e conferma visibile all’utente.
- Nessuna sovrascrittura silenziosa di movimenti, split, trasferimenti o cancellazioni.
- Test due dispositivi, retry, doppio invio, merge e recovery.

## M4 — UX mobile-first e desktop

- Card Movimenti mobile, menu azioni e safe area.
- Repository paginato e ricerca indicizzata per dataset grandi.
- Stato connessione, origine dati, conflitto e modalità offline comprensibili.
- Audit 320/375/768/1024/1440, zoom 200%, tastiera e screen reader.

## M5 — PWA, backup e release

- Test aggiornamento Service Worker con due build senza perdita di dati.
- Backup/restore cross-backend con digest canonico e campagne ripetute.
- Benchmark realistici con dataset completo, quota/interruzioni e osservabilità.
- Gate: verify, E2E, security scan, smoke LAN multi-dispositivo, report di rilascio.

## Criterio di accettazione

Due dispositivi autorizzati devono poter vedere lo stesso ledger, usare l’app offline quando il server non è disponibile, recuperare senza perdita dati e risolvere conflitti senza sovrascritture silenziose.
