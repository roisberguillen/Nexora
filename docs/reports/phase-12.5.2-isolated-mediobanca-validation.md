# Phase 12.5.2 — Isolated Mediobanca Sample Validation

The user-provided monthly Mediobanca CSV was read outside the repository and only in the isolated
browser origin 127.0.0.1:4174. No source file, row content, personal identifier, balance, amount,
statement description or source hash is retained here.

## Scope and isolation

- The definitive Nexora origin 127.0.0.1:5173 was not opened or mutated.
- A separate EUR checking account named for validation only was created in the 4174 ledger.
- The source was neither edited nor copied into the repository.
- The isolated ledger retains the batch audit and cancelled transactions after undo, as required by
  the import audit model. It must not be treated as the definitive user ledger.

## Source and mapping

| Check | Verified result |
| --- | --- |
| Financial source rows | 48 |
| CSV structure | UTF-8 BOM, semicolon delimiter, six expected columns |
| Financial date | Data valuta exclusively; 48 valid values |
| Other date | Data contabile was never mapped or used |
| Amount rule | exactly one populated amount cell per row; all source rows are signed outgoing amounts |
| Currency | EUR on every row |
| Account | explicit isolated local EUR checking account |
| Note | Tipologia only |
| Category, counterparty, transfer | absent in source; no inference and no transfer creation |

The explicit UI mapping was Data valuta → Data, Uscite → Importo, Divisa → Valuta,
Tipologia → Nota, and a user-selected local account. Data contabile, Entrate and all unavailable
fields remained unmapped.

## Dry-run accounting

| Outcome | Count |
| --- | ---: |
| valid / ready | 48 |
| duplicate | 0 |
| needs_review | 0 |
| ignored | 0 |
| invalid | 0 |
| **source financial rows** | **48** |

Invariant verified: 48 = 48 + 0 + 0 + 0 + 0.

The real monetary totals and minimum/maximum dates were calculated only for the user-facing,
non-persistent hand-off; they are deliberately excluded from this committed report.

## Commit, undo and idempotence

| Step | Result |
| --- | --- |
| Atomic commit | committed; 48 rows imported, zero skipped and zero review rows |
| Undo | batch status undone; all 48 imported transactions are cancelled and excluded from balances/reports while audit remains intact |
| Second import dry-run | 48 duplicates, zero ready, zero review |

The second confirmation control was correctly disabled because it had zero committable rows. This
is the expected idempotent behavior: no second batch can create a movement after the same source
has been committed and undone.

## Product regression fixed during validation

The import screen displayed an explicit fallback account but retained parser status needs_review for
source rows without an account column. The fix makes such a row ready only when it already has a
valid date and amount and the user has selected an account explicitly. Malformed date/amount rows
remain review-only. The change has synthetic regression coverage and does not relax source
validation or financial semantics.

## Outcome

**FASE 12.5.2 — COMPLETA.** The sample month is fully explained, committed only to an isolated
ledger, undone successfully and proven idempotent. Phase 12.5.3 has not been started.
