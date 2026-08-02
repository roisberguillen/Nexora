# Known failures

## Active

- `pnpm manifest:check` can remain stale while unrelated pre-existing mockup deletions and temporary
  extraction files are present in the working tree. Do not regenerate or stage them as part of an
  unrelated task.

## Resolved patterns

- Programmatic Vite E2E servers must allow a fallback port when the visible app already owns 5173.
- Python Windows aliases may be unavailable; Codex's bundled Python can run skill validation without
  adding a project dependency. The system `quick_validate.py` currently also lacks its `PyYAML`
  module, so `pnpm codex:validate` enforces equivalent frontmatter/name/placeholder checks offline.
