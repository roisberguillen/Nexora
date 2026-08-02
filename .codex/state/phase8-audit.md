# Phase 8 audit

Sources: PRD 4.9–4.11, repository map, importers, import/export UI and pertinent tests.

## Verified capabilities

- Local XLSX/PDF preview, automatic/manual mapping and row-level review.
- Dry-run, duplicate detection, explicit transfer confirmation, atomic batch and undo.
- Money Manager, Mediobanca XLSX and conservative N26 PDF paths.
- CSV/XLSX movement export and versioned JSON with canonical minor units.
- CSV formula neutralization and local-only file generation.

## Missing or incomplete slices

1. Transfer-only batches remain disabled after explicit confirmation — current atomic fix.
2. [Resolved] Excel serial dates are normalized from raw workbook values and tested; serial 60 is
   conservatively rejected because it represents Excel's fictitious 1900-02-29.
3. [Resolved] Original raw cells are preserved in the audit payload; validated reusable mapping
   profiles persist locally and their selected identifier survives in SQLite/IndexedDB batch data.
4. [Resolved] Generic UTF-8 CSV import supports safe delimiter detection, quoted records, source
   audit, mapping preview and explicit atomic confirmation under schema v15.
5. [Resolved] “Complete” JSON uses the versioned portable ledger snapshot, includes all supported
   entities and relations and does not apply the transaction filters used by CSV/XLSX exports.
6. [Resolved] Import history exposes an accessible aggregate quality report accounting every row
   as imported, skipped or failed/requiring review.

Phase 8 completed after targeted tests, responsive E2E and the complete repository quality gate.
