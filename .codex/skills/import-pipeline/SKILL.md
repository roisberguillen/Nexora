# Skill: Import Pipeline
Usare per Money Manager XLSX e ogni estratto conto.

Pipeline obbligatoria: hash → parse → map → normalize → validate → deduplicate → preview → dry-run → atomic commit → report → undo.
Mai importare direttamente durante il parsing. Mai scartare righe senza stato e motivazione.
