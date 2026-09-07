# Current task

- Task: 16.0 — Replicable operation schema, append-only log, payloads, revisions and cursors
- Roadmap phase: Phase 16
- Status: `COMPLETE / PASS` — Rust operation schema carries payload/digest/tombstone metadata; append-only log assigns deterministic revision/cursor, deduplicates idempotency keys and rejects stale revisions; no SQLite migration or accounting behavior changed; P0/P1/P2 aperti 0/0/0.
- Evidence: `.codex/reviews/phase-16-0-operation-schema.md`; `.codex/state/test-evidence.md`.
- Next task: `16.1 — Push/pull transport, idempotency, replay protection and durable checkpoints`.
