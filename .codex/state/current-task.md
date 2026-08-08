# Current task

- Task: clarify and secure financial reset, total reset and forgotten app-lock recovery
- Roadmap phase: Phase 12 remains next; this is a critical corrective slice before new features
- Category: encryption
- Profile: CRITICAL
- Data risk: low for this implementation; the user-visible action remains destructive only after
  explicit confirmation
- Status: verified; ready for the dedicated corrective commit and publication
- Decision: a backup passphrase is only for a newly created optional encrypted archive. A forgotten
  app-lock PIN cannot be recovered; total local reset is available after ledger readiness and keeps
  Google Drive backups untouched.
- Checkpoint: `.codex/state/checkpoints/2026-08-08-reset-recovery-ux-safe.md`
- Next task: publish this verified corrective slice, then resume Phase 12 from its routed vertical
  slice.
