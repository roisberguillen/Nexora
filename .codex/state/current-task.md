# Current task

- Task: persist reusable import mapping profiles and associate them with batches
- Roadmap phase: Phase 8
- Category: repository_refactor
- Profile: ADVANCED
- Data risk: medium; additive reversible SQLite v14 and metadata-only IndexedDB v14 upgrade
- Status: ready for commit and push
- Initial files: import batch domain, migration, SQLite/IndexedDB codecs, profile UI/store and tests
- Extra reads: none
- Attempts: 4; fixed duplicate-column validation, exact optional typing, E2E formatting and v14
  backup fixtures
- Checkpoint: migration is additive and reversible; no destructive backup checkpoint required
- Targeted tests: migration, rollback, adapter parity, backup, validation and responsive import E2E
- Completed gates: targeted suites, workspace typecheck, production build and 15 responsive E2E
- Completed gates: orchestrator validation and full repository verification
- Next task: generic CSV import with preview and explicit confirmation
