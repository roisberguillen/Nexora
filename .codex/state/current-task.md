# Current task

- Task: normalize Excel serial dates in Money Manager preview
- Roadmap phase: Phase 8
- Category: repository_refactor
- Profile: ADVANCED
- Data risk: low; preview remains read-only and ambiguous serial 60 is rejected
- Status: ready for commit and push
- Initial files: Money Manager preview parser and tests
- Extra reads: none
- Attempts: 1; the first full gate found only Prettier drift in the new test
- Checkpoint: not required; preview parsing changes are read-only and do not mutate stored data
- Targeted tests: importer preview, workbook round-trip and regression import suite
- Completed gates: 7 targeted tests, importer package typecheck, orchestrator validation and full
  repository verification
- Next task: preserve raw import source values and reusable mapping profiles
