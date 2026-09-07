# 12.5.E.3 — Data Integrity & Recovery Final Gate

Data: 2026-09-07
Branch: `codex/phase-12-5-0-checkpoint`
Baseline: `e50b16d` (`test(release): pass phase 12.5.E.2 real-flow regression`)

## Preconditions and scope

`12.5.D = PASS`, `12.5.E.1 = PASS` ed `12.5.E.2 = PASS` sono prerequisiti verificati.
Questa slice verifica soltanto integrità dati, cifratura, checksum, rollback, restore e parity
tra adapter. Nessuna feature o modifica runtime è stata introdotta.

## Integrity matrix

| ID | Check | Result | Evidence | Severity |
| --- | --- | --- | --- | --- |
| DI-01 | Portable snapshot round-trip | PASS | `PortableLedgerSnapshot.test.ts`, 120 targeted tests | — |
| DI-02 | Encrypted archive create/verify/decrypt | PASS | encrypted backup and portable engine tests | — |
| DI-03 | Checksum/tamper rejection | PASS | backup engine checksum and archive validation tests | — |
| DI-04 | Wrong passphrase rejection | PASS | encrypted backup negative-path tests | — |
| DI-05 | Manifest/schema compatibility | PASS | portable backup manifest validation tests | — |
| DI-06 | Restore rollback on failure | PASS | SQLite and IndexedDB repository rollback tests | — |
| DI-07 | Atomic migration rollback | PASS | migration rollback tests and `atomic-rollback.spec.ts` | — |
| DI-08 | SQLite/OPFS restore | PASS | `backup-restore.spec.ts`, C4.9 recovery flow | — |
| DI-09 | IndexedDB persistence/reopen | PASS | IndexedDB repository tests and E2E persistence | — |
| DI-10 | Cross-adapter data contract | PASS | shared portable snapshot and adapter suites | — |
| DI-11 | Financial invariants | PASS | transfer neutrality, minor units and balances | — |
| DI-12 | Native adapter compile gate | PASS | `cargo check` in `apps/web/src-tauri` | — |

## Evidence

- Targeted integrity suite: 9 file, `120 passed`, `0 failed`.
- Targeted recovery E2E: `13 passed`, `29 skipped`, `0 failed` su 42 test.
- Full E.2 suite: `433 passed`, `233 skipped`, `0 failed`.
- `pnpm verify`: format/lint/typecheck/build PASS; Vitest `633 passed`, `4 skipped`.
- `pnpm manifest:check`: PASS.
- `cargo check`: PASS.

Gli skip sono condizionali per backend, provider, profilo o viewport come definito dal test
harness; nessun controllo obbligatorio è stato saltato silenziosamente. Non sono emerse
corruzioni, partial restore, checksum bypass, accettazione di passphrase errata o incompatibilità
tra adapter. Nessun dato reale o artefatto persistente è stato usato.

## Decision

- P0: 0
- P1: 0
- P2: 0

**12.5.E.3 = PASS**

Next: `12.5.E.F — Final Phase E Gate` (non iniziato). `12.5.F` e Phase 13 restano fuori scope.
