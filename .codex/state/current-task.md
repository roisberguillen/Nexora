# Current task

- Task: preserve raw import source values in the audit trail
- Roadmap phase: Phase 8
- Category: repository_refactor
- Profile: ADVANCED
- Data risk: low; immutable source cells are added to existing JSON audit payloads
- Status: ready for commit and push
- Initial files: Money Manager preview parser, parser test and isolated audit persistence test
- Extra reads: none
- Attempts: 0
- Checkpoint: not required; preview parsing changes are read-only and do not mutate stored data
- Targeted tests: immutable raw cells and in-memory audit round-trip
- Completed gates: 10 targeted tests and importer/web typechecks
- Completed gates: orchestrator validation and full repository verification
- Next task: persist reusable mapping profiles and associate them with import batches
