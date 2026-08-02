# Current task

- Task: allow confirmation of transfer-only import batches
- Roadmap phase: Phase 8
- Category: ui_component
- Profile: STANDARD
- Data risk: low; existing atomic repository command remains unchanged
- Status: ready for commit and push
- Initial files: `ImportsPage.tsx`, import review helper/test and import E2E
- Extra reads: none
- Attempts: 1; E2E initially used a stale production build and passed after rebuilding
- Checkpoint: not required; no data or application behavior is modified
- Targeted tests: import review unit test, import command regression and transfer-only E2E
- Completed gates: 9 targeted unit tests, web typecheck, web build and 6 responsive E2E
- Next task: normalize and test Excel serial dates in Money Manager preview
