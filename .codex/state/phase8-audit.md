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
3. [Partial] Original raw cells are preserved in the audit payload; reusable mapping profiles and
   their batch association remain open.
4. Generic CSV import is absent.
5. “Complete” JSON omits several ledger aggregates and applies transaction filters implicitly.
6. Final import report is limited to batch history and lacks a dedicated quality report.

Do not mark Phase 8 complete until each accepted slice has targeted tests and phase-level gates.
