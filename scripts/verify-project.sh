#!/usr/bin/env sh
set -eu
printf 'Checking required Nexora files...\n'
for f in AGENTS.md docs/PRD.md docs/ARCHITECTURE.md docs/DATA_MODEL.md docs/ROADMAP.md; do
  test -f "$f" || { echo "Missing $f"; exit 1; }
done
printf 'Project documentation structure OK.\n'
