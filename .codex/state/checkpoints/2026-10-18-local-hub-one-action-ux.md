# Local Hub one-action UX checkpoint

- Date: 2026-10-18 (Europe/Rome).
- Task: replace manual phone-to-PC pairing/passcode entry with one-action Local Hub access.
- Route: `local_hub`, CRITICAL, medium data risk; trust-model change.
- Baseline: `main`; pre-existing uncommitted changes listed by `git status` and left untouched.
- User preference: automatic first-time PC read and write access on the same Wi-Fi, without a code or phone confirmation.
- Data guarantee: documentation only at this checkpoint; no phone ledger, credentials, app state or listener changed.
- Required before implementation: explicit protocol design, independent security review, negative tests, physical Pixel/PC gate and full verification.
- Current gate: an independent security reviewer is not available in the connected tools. The Local Hub backend has not been changed; ADR 0023 remains Proposed.
- Documentation checks: Prettier, `pnpm codex:validate` and `git diff --check` pass.
