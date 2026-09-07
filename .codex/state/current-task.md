# Current task

- Task: 16.1 — Push/pull transport, idempotency, replay protection and durable checkpoints
- Roadmap phase: Phase 16
- Status: `COMPLETE / PASS` — Sync transport implements incremental push/pull, delivery replay rejection, cursor checkpoint bounds and reuse of operation idempotency; no SQLite migration or accounting behavior changed; P0/P1/P2 aperti 0/0/0.
- Evidence: `.codex/reviews/phase-16-1-push-pull-transport.md`; `.codex/state/test-evidence.md`.
- Next task: `16.2 — Offline queue, retry, partial/duplicate delivery and reconciliation`.
