# Phase 12.5.1 — Real Source Mapping Report

Read-only assessment: all three user files were opened outside the repository. No account, transaction, category, tag, import batch, backup or ledger was created or changed. This report retains no balance, description, counterparty, identifier, IBAN or source-row value.

## 1. File analysed

| Source | Type / structure | Result |
| --- | --- | --- |
| Mediobanca Premier | UTF-8-BOM semicolon CSV; 49 physical rows, 6 columns | dates, separate income/expense cells and EUR; no account, narrative, category or source ID |
| N26 | 20-page text-extractable PDF | Mastercard detail, main-account section and six Space sections; summaries/legal text excluded |
| Money Manager | XLSX; one visible `Money Manager` sheet, 11 columns, 46 physical rows | 45 post-header source rows with account, date, amount, currency, kind and category fields |

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

## 5. Money Manager workbook

The replacement workbook is usable for mapping. It has one visible sheet with 46 physical rows:
one header plus 45 source rows. Its 11 header positions are `Giorno`, `Conto`, `Categoria`,
`Sotto-categoria`, `Nota`, `EUR`, `Guadagni/Spese`, `Descrizione`, `Importo`, `Valuta`, `Conto`.
The duplicated `Conto` heading is preserved as two distinct physical positions during analysis.

| Source position | Observed form | Canonical proposal | Status |
| --- | --- | --- | --- |
| `Giorno` | 45 Excel serial dates | `date` → civil `YYYY-MM-DD` | TRANSFORM |
| first `Conto` | 45 values, 3 distinct labels | `account` | TRANSFORM after explicit account resolution |
| `Categoria` | 45 values, 9 labels | `category` | NEEDS_REVIEW against active compatible Nexora categories |
| `Sotto-categoria` | 40 values, 14 labels | `subcategory` | NEEDS_REVIEW; preserve as source/audit data until profile support resolves it |
| `Nota` | 44 values | `note` | TRANSFORM |
| `Guadagni/Spese` | 41 expense, 2 income, 2 transfer markers | `type` | TRANSFORM; transfers require both own accounts resolved |
| `Descrizione` | 2 values | supplementary `note` only, never silently a payee | NEEDS_REVIEW |
| `Importo` | 45 numeric values | `amount` → EUR minor-unit `bigint` | TRANSFORM after one sign rule |
| `Valuta` | EUR on all rows | `currency` | TRANSFORM |
| `EUR` and second `Conto` | numeric, respectively 37 distinct values | no canonical field selected | UNSUPPORTED pending documented export semantics |

The first `Conto` has 40 Mediobanca-labelled rows, four N26-labelled rows and one other source
label. The other label is `needs_review`; it is not inferred as Directa SIM. No Directa-labelled row
is present. The numeric second `Conto` differs from the first account on every row and cannot safely
be treated as a destination account merely because its header is duplicated.

The current generic Money Manager detector recognises the first `Conto`, `Categoria`, `Nota`,
`Importo` and `Valuta`, but not `Giorno` or `Guadagni/Spese`; it also has no separate duplicate
account/destination-account field. Its automatic preview would therefore be unsafe for this
workbook. A subsequent importer profile must support these confirmed positions explicitly; it must
not select a fallback account or convert the two transfer-marked rows to income/expense.

## 6. Mapping account

| Source | Source name | Proposed entity | Type | Currency | Transformation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Mediobanca CSV | file-level confirmed source | Mediobanca Premier account | `checking` | EUR | explicit resolution; `Data valuta` only | TRANSFORM |
| N26 PDF | main-account section | N26 main account | `checking` | EUR | parser-dependent signed operations | NEEDS_REVIEW |
| N26 PDF | each Space section | child of N26 main account | `virtual_subaccount` | EUR | safe pairing + explicit Space resolution | NEEDS_REVIEW |
| Money Manager XLSX | Mediobanca-labelled first `Conto` rows | same resolved Mediobanca account | `checking` | EUR | explicit mapping profile; no fallback | NEEDS_REVIEW |
| Money Manager XLSX | N26-labelled first `Conto` rows | same resolved N26 main account | `checking` | EUR | explicit mapping profile; no fallback | NEEDS_REVIEW |
| Money Manager XLSX | one other source label | none until user/account resolution | — | EUR | do not guess | NEEDS_REVIEW |
| Directa SIM | no Directa-labelled source row | none | — | — | absence recorded; do not manufacture an account | UNSUPPORTED |

## 7. Directa SIM

Directa is not represented under an identifiable source label in the analysed files. Future mapping
must separate brokerage cash flow (transactions/transfers) from valuation (`InvestmentPosition`). A
position requires actual name, valuation date and monetary values plus an active matching-currency
`investment` account. Ticker, units, average cost, gains/losses and holdings must not be
reconstructed from balance movements.

## 8. Categories

| Source | Category source | Nexora proposal | Confidence | Action |
| --- | --- | --- | --- | --- |
| Mediobanca CSV | none | none | N/A | leave unclassified |
| N26 PDF | no verified field | none | N/A | do not infer from description |
| Money Manager XLSX | 9 category and 14 subcategory labels | resolve only to an explicit active Nexora category accepting the derived kind | review required | mapping profile/preview, never auto-create |

Only an explicit active Nexora category accepting the derived income/expense kind can be deterministic. Creating categories is out of scope.

## 9. Transfers

Bank ↔ bank requires explicit account and counterpart evidence. N26 ↔ Space uses the atomic rule
above. Bank ↔ Directa is a transfer only when both accounts/counterparts are evidenced; valuation
is not cash flow. The two Money Manager transfer-marked rows require explicit origin and destination
resolution in the import profile and confirmation in preview; they must remain `needs_review` until
then.

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

- The existing Money Manager generic detector does not recognise the confirmed `Giorno` and
  `Guadagni/Spese` headers, nor can it distinguish the duplicated account heading.
- `EUR` and the second numeric `Conto` lack a documented source-export semantic and are excluded
  from canonical mapping.
- Mediobanca lacks narrative/identifier fields, limiting transfer and cross-source deduplication.
- N26 lacks a verified Space pairing key and value date.
- Existing source-specific parsers do not match observed Mediobanca CSV or N26 PDF semantics.

## 13. Risks

| Priority | Finding | Mitigation |
| --- | --- | --- |
| P0 | none; no ledger mutation | retain preview/dry-run/confirmation |
| P1 | generic Money Manager detection would omit date/type and cannot model its duplicate account heading | 12.5.6 tested, explicit mapping profile; all affected rows begin as review-only |
| P1 | Mediobanca parser expects XLSX and selects another date | 12.5.6 tested CSV mapping enforces `Data valuta` |
| P1 | N26 parser yields zero rows and Space pairing is uncertain | 12.5.6 parser plus reviewable pairing preview |
| P2 | PDF renderer unavailable | recheck parser preview against original layout before commit |

## 14. Strategy for subsequent phases

- **12.5.2:** implement only the reviewed mapping profile/preview flow; enforce explicit account
  resolution and the Money Manager `Giorno`/`Guadagni/Spese` positions.
- **12.5.3:** first add a tested N26 parser and Space pairing review; unpaired rows stay `needs_review`.
- **12.5.4:** Directa remains absent until a separately identified brokerage source is provided;
  do not fabricate holdings from this workbook.
- **12.5.5:** reconcile with strong IDs first and review-only medium keys; preserve both sources.
- **12.5.6:** address the two parser gaps with synthetic equivalent fixtures, never these sources.

## Outcome

**FASE 12.5.1 — COMPLETA.** The real-source mapping is documented and no real data was persisted.
The next authorized work may be **12.5.2**; no import is authorized until its explicit mapping,
preview, dry-run and confirmation gates are implemented and verified.
