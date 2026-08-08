# Current task

- Task: Phase 12.1 hierarchical financial categories
- Roadmap phase: Phase 12, first vertical slice
- Category: repository refactor / UI component (escalated from initial STANDARD route)
- Profile: ADVANCED
- Data risk: low; existing `categoryId` values and transactions are preserved without migration
- Status: verified; ready for the dedicated Phase 12.1 commit and publication
- Decision: Macro category → Subcategory is the only user-visible depth. The default taxonomy is
  explicit and fresh-ledger-only; it never changes a user's existing categories.
- Next task: publish this slice after all gates, then begin Phase 12.2 without starting it here.
