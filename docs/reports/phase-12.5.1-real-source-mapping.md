# Phase 12.5.1 — Real Source Mapping Report

Read-only assessment: all three user files were opened outside the repository. No account, transaction, category, tag, import batch, backup or ledger was created or changed. This report retains no balance, description, counterparty, identifier, IBAN or source-row value.

## 1. File analysed

| Source | Type / structure | Result |
| --- | --- | --- |
| Mediobanca Premier | UTF-8-BOM semicolon CSV; 49 physical rows, 6 columns | dates, separate income/expense cells and EUR; no account, narrative, category or source ID |
| N26 | 20-page text-extractable PDF | Mastercard detail, main-account section and six Space sections; summaries/legal text excluded |
| Money Manager | XLSX with one `Money Manager` sheet | no usable header or transaction row |

The bundled PDF renderer was unavailable. The PDF classification uses successful local text extraction and page-level markers only; no image/text is retained.

## 2. Mediobanca Premier

Observed columns: `Data contabile`, `Data valuta`, `Tipologia`, `Entrate`, `Uscite`, `Divisa`. `Data valuta` is valid on all 48 data rows in day/month/four-digit-year form; `Data contabile` is incomplete on five rows and is never a fallback. All observed rows are EUR and have one Italian-decimal `Uscite` amount.

**The date of a Nexora transaction for Mediobanca Premier derives exclusively from `Data valuta`.** It maps to `transaction.bookedDate`; absent/invalid data is `needs_review` or `invalid`, never silently replaced by `Data contabile`.

| Proposed account | Type / currency | Direction / category | Transfer and deduplication |
| --- | --- | --- | --- |
| explicitly user-confirmed Mediobanca Premier account | `checking` / EUR | sole `Entrate` → positive income; sole `Uscite` → negative expense after one sign normalization; no source category/tag | no deterministic transfer signal; strong fingerprint = source SHA-256 + row + account + minor amount |

Both/empty amount cells are `invalid`. Account + `Data valuta` + amount + EUR is a cross-source review candidate only, because the source lacks narrative and identifiers.

## 3. N26

The PDF is a statement rather than canonical tabular data. It has four Mastercard-detail pages, a main-account balance/operations section, six Space sections and informational/legal pages. Transaction sections contain date, description and amount; no distinct `Data valuta` was observed. Main account proposal: `checking` / EUR; a valid signed ordinary operation uses the statement date as `bookedDate` and leaves `valueDate` absent. Missing date/amount/section is `needs_review`; period, balances and legal text are `ignored`.

The current `readN26Pdf` expects English month text and a simple three-line layout. It yielded zero candidate rows for this PDF: a Phase 12.5.6 parser gap, not a reason to alter the source or force an import.

## 4. N26 Spaces

Nexora can model every observed Space as an EUR `virtual_subaccount` whose `parentAccountId` is the N26 main account. A main-account → Space move and the inverse must be one atomic `Transfer` (negative debit plus positive credit), never income/expense. The PDF exposes no verified parser-ready pairing key. Require a strong source ID; otherwise only propose a review candidate when source/destination section, amount and date agree. Collision, repeated same-day/amount movement, missing side or ambiguous Space is `needs_review`. Temporary safe behavior is preview/audit only until a format-specific parser and pairing review exist.

## 5. Money Manager

The workbook is structurally empty. It cannot establish accounts (including Mediobanca, N26, Directa SIM), transfers, splits, categories, tags, notes, N26-Space history or Directa operations. No inferred mapping is recorded. A complete Money Manager export with headers and rows is required.

## 6. Mapping account

| Source | Source name | Proposed entity | Type | Currency | Transformation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Mediobanca CSV | file-level confirmed source | Mediobanca Premier account | `checking` | EUR | explicit resolution; `Data valuta` only | TRANSFORM |
| N26 PDF | main-account section | N26 main account | `checking` | EUR | parser-dependent signed operations | NEEDS_REVIEW |
| N26 PDF | each Space section | child of N26 main account | `virtual_subaccount` | EUR | safe pairing + explicit Space resolution | NEEDS_REVIEW |
| Money Manager XLSX | unavailable | none | — | — | await usable export | UNSUPPORTED |
| Directa SIM | unavailable | none | — | — | await Money Manager/brokerage evidence | UNSUPPORTED |

## 7. Directa SIM

No Directa evidence is available. Future mapping must separate brokerage cash flow (transactions/transfers) from valuation (`InvestmentPosition`). A position requires actual name, valuation date and monetary values plus an active matching-currency `investment` account. Ticker, units, average cost, gains/losses and holdings must not be reconstructed from balance movements.

## 8. Categories

| Source | Category source | Nexora proposal | Confidence | Action |
| --- | --- | --- | --- | --- |
| Mediobanca CSV | none | none | N/A | leave unclassified |
| N26 PDF | no verified field | none | N/A | do not infer from description |
| Money Manager XLSX | unavailable | none | N/A | await usable export |

Only an explicit active Nexora category accepting the derived income/expense kind can be deterministic. Creating categories is out of scope.

## 9. Transfers

Bank ↔ bank requires explicit account and counterpart evidence. N26 ↔ Space uses the atomic rule above. Bank ↔ Directa is a transfer only when both accounts/counterparts are evidenced; valuation is not cash flow. A Money Manager source/destination pair requires explicit Import Engine confirmation.

## 10. Deduplication

| Strength | Rule |
| --- | --- |
| Strong | immutable source ID; otherwise source SHA-256 + row + account + minor amount |
| Medium | account + source-selected date + minor amount + currency + normalized narrative when available |
| Weak | date + amount only; never auto-merge |
| Ambiguous | collision, reversed sign, multiple accounts, Space uncertainty or missing field → `needs_review` |

The repository keeps import rows, raw/normalized JSON and batch status for audit and enforces a per-account source fingerprint. Re-importing the same source yields `skipped_duplicate`; cross-source reconciliation is reviewable.

## 11. Normalisation

- Preserve raw cells only in confirmed import audit, never fixtures/tests/logs.
- Convert civil dates to `YYYY-MM-DD`; Mediobanca uses `Data valuta` only, with no UTC conversion.
- Parse Italian decimals directly to EUR minor-unit `bigint`; validate exactly one semantic sign and currency.
- Whitespace/Unicode normalization is only for matching keys; raw audit data remains unchanged.
- Account mapping is explicit; filename is not universal proof of account identity.

## 12. Limits found

- Money Manager is unusable, so history and Directa are unknown.
- Mediobanca lacks narrative/identifier fields, limiting transfer and cross-source deduplication.
- N26 lacks a verified Space pairing key and value date.
- Existing source-specific parsers do not match observed Mediobanca CSV or N26 PDF semantics.

## 13. Risks

| Priority | Finding | Mitigation |
| --- | --- | --- |
| P0 | none; no ledger mutation | retain preview/dry-run/confirmation |
| P1 | missing Money Manager export | obtain it before 12.5.4 |
| P1 | Mediobanca parser expects XLSX and selects another date | 12.5.6 tested CSV mapping enforces `Data valuta` |
| P1 | N26 parser yields zero rows and Space pairing is uncertain | 12.5.6 parser plus reviewable pairing preview |
| P2 | PDF renderer unavailable | recheck parser preview against original layout before commit |

## 14. Strategy for subsequent phases

- **12.5.2:** only after a reviewed CSV-capable Mediobanca mapper enforces `Data valuta`.
- **12.5.3:** first add a tested N26 parser and Space pairing review; unpaired rows stay `needs_review`.
- **12.5.4:** blocked until a complete Money Manager export arrives; analyse it before Directa/category/split mapping.
- **12.5.5:** reconcile with strong IDs first and review-only medium keys; preserve both sources.
- **12.5.6:** address the two parser gaps with synthetic equivalent fixtures, never these sources.

## Outcome

**FASE 12.5.1 — BLOCCATA: manca la fonte necessaria Money Manager con intestazioni e righe utilizzabili.**

Provide a usable Money Manager export before account/category/Directa mapping or a later import phase can be scheduled.
