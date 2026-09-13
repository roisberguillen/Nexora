# Checkpoint — Phone Local Hub Android roadmap

- Date: 2026-09-14
- Branch: `codex/pc-manager-local-browser`
- Scope: define and start the phone-as-host integration for the Pixel 9.
- Baseline commit: `aa08860b43c2df755c4392bd0db7d41e9315e96f`
- Baseline behavior: the completed PM-0–PM-8 flow uses the PC as Local Hub host and the phone as pairing/controller.
- New target behavior: the Pixel 9 may explicitly start a temporary Local Hub host; the PC connects as an authorized desktop client.
- Safety boundary: no real financial data, database files, credentials, passcodes or device secrets are copied into fixtures, logs or commits.
- Rollback: documentation and state changes can be reverted independently; no data migration or ledger mutation is part of PMA-0.
- Stop conditions: missing Android lifecycle/secure-storage capability, undefined conflict policy, new broad permission requirement, failed independent security review, or any unauthenticated ledger path.
